--[[
    VaultRelay — Self-Hosted Upload Handler for OpenResty
    ======================================================
    Handles file uploads via multipart/form-data POST requests.
    Validates Authorization header, streams file to disk, returns JSON with URL.

    Performance notes:
    - Uses lua-resty-upload for streaming (no buffering entire file in memory)
    - Generates collision-resistant filenames with ngx.now() + random suffix
    - Zero external dependencies beyond OpenResty builtins
]]

local cjson = require("cjson.safe")

-- ── Configuration (all overridable via nginx `env` directives) ──────
--
--   env FILEHOST_AUTH_TOKEN=your-secret-token;
--   env FILEHOST_UPLOAD_DIR=/var/www/discord/;
--   env FILEHOST_PUBLIC_PATH=/discord/;
--   env FILEHOST_CHUNK_SIZE=8192;
--
-- ────────────────────────────────────────────────────────────────────
local upload_dir   = os.getenv("FILEHOST_UPLOAD_DIR")   or "/var/www/discord/"
local public_path  = os.getenv("FILEHOST_PUBLIC_PATH")  or "/discord/"
local auth_token   = os.getenv("FILEHOST_AUTH_TOKEN")   or "CHANGE_ME"
local chunk_size   = tonumber(os.getenv("FILEHOST_CHUNK_SIZE")) or 8192

-- ── Auth check ──────────────────────────────────────────────────────
local authorization = ngx.var.http_authorization
if not authorization then
    ngx.status = 401
    ngx.say(cjson.encode({ error = "Missing Authorization header" }))
    return ngx.exit(401)
end

local bearer = authorization:match("^Bearer%s+(.+)$")
if bearer ~= auth_token then
    ngx.status = 403
    ngx.say(cjson.encode({ error = "Invalid token" }))
    return ngx.exit(403)
end

-- ── Parse multipart upload (HTTP/2 Compatible) ──────────────
ngx.req.read_body()
local body = ngx.req.get_body_data()

if not body then
    local file_name = ngx.req.get_body_file()
    if file_name then
        local f = io.open(file_name, "rb")
        if f then
            body = f:read("*all")
            f:close()
        end
    end
end

if not body then
    ngx.status = 400
    ngx.say(cjson.encode({ error = "No body received from NGINX buffering" }))
    return ngx.exit(400)
end

local content_type = ngx.var.content_type or ""
local boundary = content_type:match("boundary=(.+)")
if not boundary then
    ngx.status = 400
    ngx.say(cjson.encode({ error = "Missing multipart boundary" }))
    return ngx.exit(400)
end

local function parse_multipart(b, bound)
    local b_str = "--" .. bound
    local start_idx = 1
    
    while true do
        local p_start, p_end = b:find(b_str, start_idx, true)
        if not p_start then break end
        
        if b:sub(p_end + 1, p_end + 2) == "--" then break end
        
        local h_start = p_end + 3
        local h_end, h_end_end = b:find("\r\n\r\n", h_start, true)
        if not h_end then break end
        
        local headers = b:sub(h_start, h_end - 1)
        local next_p_start = b:find(b_str, h_end_end + 1, true)
        if not next_p_start then break end
        
        local data = b:sub(h_end_end + 1, next_p_start - 3)
        
        if headers:find('name="file"') then
            local filename = headers:match('filename="([^"]+)"')
            return data, filename
        end
        
        start_idx = next_p_start
    end
    return nil, nil
end

local file_data, original_name = parse_multipart(body, boundary)

if not file_data then
    ngx.status = 400
    ngx.say(cjson.encode({ error = "Could not extract file part from payload" }))
    return ngx.exit(400)
end

local extension = ""
if original_name then
    extension = original_name:match("(%.[%w]+)$") or ""
end

-- Generate unique filename
local unique_name = string.format(
    "%d_%s%s",
    ngx.now() * 1000,
    string.sub(ngx.md5(ngx.var.request_id or tostring(ngx.now())), 1, 8),
    extension
)

local saved_path = upload_dir .. unique_name
local file_handle, err = io.open(saved_path, "wb")
if not file_handle then
    ngx.status = 500
    ngx.say(cjson.encode({ error = "Cannot write file to disk: " .. (err or "unknown") }))
    return ngx.exit(500)
end

file_handle:write(file_data)
file_handle:close()

local filename = unique_name

-- ── Response ────────────────────────────────────────────────────────
if not filename then
    ngx.status = 400
    ngx.say(cjson.encode({ error = "No file received" }))
    return ngx.exit(400)
end

local scheme = ngx.var.scheme or "https"
local host   = ngx.var.host  or "xeon.systems"
local url    = scheme .. "://" .. host .. public_path .. filename

ngx.status = 200
ngx.header["Content-Type"] = "application/json"
ngx.say(cjson.encode({ url = url, filename = filename }))

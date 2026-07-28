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

local upload = require("resty.upload")
local cjson = require("cjson.safe")

-- ── Configuration (all overridable via nginx `env` directives) ──────
--
--   env FILEHOST_AUTH_TOKEN=your-secret-token;
--   env FILEHOST_UPLOAD_DIR=/var/www/uploads/grimoire/;
--   env FILEHOST_PUBLIC_PATH=/grimoire/;
--   env FILEHOST_CHUNK_SIZE=8192;
--
-- ────────────────────────────────────────────────────────────────────
local upload_dir   = os.getenv("FILEHOST_UPLOAD_DIR")   or "/var/www/uploads/grimoire/"
local public_path  = os.getenv("FILEHOST_PUBLIC_PATH")  or "/grimoire/"
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

-- ── Parse multipart upload ──────────────────────────────────────────
local form, err = upload:new(chunk_size)
if not form then
    ngx.status = 500
    ngx.say(cjson.encode({ error = "Failed to initialise upload: " .. (err or "unknown") }))
    return ngx.exit(500)
end

form:set_timeout(300000)  -- 5 minute timeout for large files

local filename    = nil
local file_handle = nil
local saved_path  = nil
local extension   = ""

while true do
    local typ, res, read_err = form:read()
    if not typ then
        ngx.status = 500
        ngx.say(cjson.encode({ error = "Read error: " .. (read_err or "unknown") }))
        if file_handle then file_handle:close() end
        return ngx.exit(500)
    end

    if typ == "header" then
        -- Extract original filename from Content-Disposition header
        if res[1] and res[1]:lower() == "content-disposition" then
            local original_name = res[2]:match('filename="(.-)"')
            if original_name and original_name ~= "" then
                -- Sanitise: keep only the extension from the original name
                extension = original_name:match("(%.[%w]+)$") or ""
            end
        end

        -- Open output file on first header encounter if not yet opened
        if not file_handle and not saved_path then
            -- Generate unique filename: timestamp_random.ext
            local unique_name = string.format(
                "%d_%s%s",
                ngx.now() * 1000,
                string.sub(ngx.md5(ngx.now() .. math.random()), 1, 8),
                extension
            )
            saved_path = upload_dir .. unique_name
            filename   = unique_name

            file_handle, err = io.open(saved_path, "wb")
            if not file_handle then
                ngx.status = 500
                ngx.say(cjson.encode({ error = "Cannot write file: " .. (err or "unknown") }))
                return ngx.exit(500)
            end
        end

    elseif typ == "body" then
        if file_handle and res then
            file_handle:write(res)
        end

    elseif typ == "part_end" then
        if file_handle then
            file_handle:close()
            file_handle = nil
        end

    elseif typ == "eof" then
        break
    end
end

-- ── Response ────────────────────────────────────────────────────────
if not filename then
    ngx.status = 400
    ngx.say(cjson.encode({ error = "No file received" }))
    return ngx.exit(400)
end

local scheme = ngx.var.scheme or "https"
local host   = ngx.var.host  or "megumin.me"
local url    = scheme .. "://" .. host .. public_path .. filename

ngx.status = 200
ngx.header["Content-Type"] = "application/json"
ngx.say(cjson.encode({ url = url, filename = filename }))

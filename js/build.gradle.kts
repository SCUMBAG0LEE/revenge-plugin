import org.apache.tools.ant.taskdefs.condition.Os
import java.io.File
import kotlin.String

group = "io.github.revenge.plugin"


tasks {
    fun registeringBunTask(vararg args: String) = registering(Exec::class) {
        group = "build"
        description = "Runs Bun with arguments: ${args.joinToString(" ")}"

        val homeBun = File(System.getProperty("user.home"), ".bun/bin/bun")
        val bunCommand = when {
            Os.isFamily(Os.FAMILY_WINDOWS) -> "bun.exe"
            homeBun.exists() -> homeBun.absolutePath
            else -> "bun"
        }

        commandLine(bunCommand, *args)
    }

    val installDependencies by registeringBunTask("install")
    val build by registeringBunTask("run", "build") {
        dependsOn(installDependencies)
    }
}

configurations {
    create("jsConfiguration") {
        isCanBeResolved = false
        isCanBeConsumed = true

        outgoing.artifact(layout.buildDirectory.dir("revenge")) {
            builtBy(tasks.named("build"))
        }
    }
}
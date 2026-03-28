import { accountRouter } from "./routers/account"
import { browserRouter } from "./routers/browser"
import { checkpointsRouter } from "./routers/checkpoints"
import { commandsRouter } from "./routers/commands"
import { fileRouter } from "./routers/file"
import { mcpRouter } from "./routers/mcp"
import { modelsRouter } from "./routers/models"
import { ocaAccountRouter } from "./routers/ocaAccount"
import { slashRouter } from "./routers/slash"
import { stateRouter } from "./routers/state"
import { taskRouter } from "./routers/task"
import { uiRouter } from "./routers/ui"
import { voiceRouter } from "./routers/voice"
import { webRouter } from "./routers/web"
import { worktreeRouter } from "./routers/worktree"
import { router } from "./trpc"

export const appRouter = router({
	account: accountRouter,
	browser: browserRouter,
	checkpoints: checkpointsRouter,
	commands: commandsRouter,
	file: fileRouter,
	mcp: mcpRouter,
	models: modelsRouter,
	ocaAccount: ocaAccountRouter,
	slash: slashRouter,
	state: stateRouter,
	task: taskRouter,
	ui: uiRouter,
	voice: voiceRouter,
	web: webRouter,
	worktree: worktreeRouter,
})

export type AppRouter = typeof appRouter

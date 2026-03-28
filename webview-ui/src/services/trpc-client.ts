import type { AppRouter } from "@shared/trpc-router-type"
import { createTRPCClient } from "@trpc/client"
import { createPostMessageLink } from "./trpc-link"

export const trpc = createTRPCClient<AppRouter>({
	links: [createPostMessageLink()],
})

# Cline Protobuf Development Guide

Protobuf defines the type-safe API between webview and extension host. All definitions in `/proto/`. No manual compiler install needed.

## Key Rules
- One `.proto` file per feature domain. Simple data → use `proto/cline/common.proto` types (`StringRequest`, `Empty`, `Int64Request`). Complex data → define custom messages in the feature's `.proto`.
- Naming: `PascalCaseService`, `camelCase` RPCs, `PascalCase` messages. Streaming → `stream` keyword on response type.
- **After any `.proto` change, run `npm run protos`.** Outputs to `src/generated/` and `src/shared/`. Never edit generated files manually.

## 4-Step Workflow

1. **Define** — Add RPC to `proto/<feature>.proto`
2. **Generate** — `npm run protos`
3. **Backend handler** — Create in `src/core/controller/<domain>/handler.ts`; signature: `async function myRpc(controller: Controller, request: MyRequest): Promise<MyResponse>`
4. **Frontend call** — `await UiServiceClient.myMethod(MyRequest.create({ ... }))` in a React component

## Common Types (proto/cline/common.proto)
`StringRequest`, `BooleanRequest`, `Int64Request`, `Empty`, `KeyValuePair`

## Streaming Example
See `subscribeToAuthCallback` in `account.proto` for a server-streaming RPC pattern.
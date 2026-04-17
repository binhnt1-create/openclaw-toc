# Maton integration notes

## Verified from ClawHub skill

A public ClawHub skill page for Gmail confirms Maton-managed Gmail endpoints.

Key domains:

- `https://gateway.maton.ai`
- `https://ctrl.maton.ai`
- `https://connect.maton.ai`

Auth:

- `Authorization: Bearer $MATON_API_KEY`

Gateway pattern:

- `https://gateway.maton.ai/google-mail/{native-api-path}`

Example:

- `https://gateway.maton.ai/google-mail/gmail/v1/users/me/messages?maxResults=10`

Connection management:

- list connections: `https://ctrl.maton.ai/connections?app=google-mail&status=ACTIVE`
- create/list connections: `https://ctrl.maton.ai/connections`
- connection details: `https://ctrl.maton.ai/connections/{connection_id}`
- OAuth connect URL may come from `https://connect.maton.ai/?session_token=...`

## Practical implication

Use Gmail native API paths after the `/google-mail/` prefix on `gateway.maton.ai`.

This means send mail should likely call the proxied Gmail endpoint:

- `/google-mail/gmail/v1/users/me/messages/send`

Payload should follow Gmail API shape:

- `{ "raw": "<base64url mime>" }`

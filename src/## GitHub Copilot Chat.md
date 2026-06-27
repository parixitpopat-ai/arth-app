## GitHub Copilot Chat

- Extension: 0.42.3 (prod)
- VS Code: 1.113.0 (cfbea10c5ffb233ea9177d34726e6056e89913dc)
- OS: win32 10.0.26200 x64
- GitHub Account: parixitpopat-ai

## Network

User Settings:
```json
  "http.systemCertificatesNode": true,
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: 20.207.73.85 (80 ms)
- DNS ipv6 Lookup: Error (48 ms): getaddrinfo ENOTFOUND api.github.com
- Proxy URL: None (1 ms)
- Electron fetch (configured): Error (1973 ms): Error: net::ERR_CONNECTION_TIMED_OUT
	at SimpleURLLoaderWrapper.<anonymous> (node:electron/js2c/utility_init:2:10684)
	at SimpleURLLoaderWrapper.emit (node:events:519:28)
  {"is_request_error":true,"network_process_crashed":false}
- Node.js https: Error (6 ms): Error: getaddrinfo ENOTFOUND api.github.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: Error (13 ms): TypeError: fetch failed
	at node:internal/deps/undici/undici:14902:13
	at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
	at async t._fetch (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5171:5228)
	at async t.fetch (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5171:4540)
	at async u (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5203:186)
	at async cg._executeContributedCommand (file:///c:/Users/parix/AppData/Local/Programs/Microsoft%20VS%20Code/cfbea10c5f/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:501:48675)
  Error: getaddrinfo ENOTFOUND api.github.com
  	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: 140.82.114.22 (289 ms)
- DNS ipv6 Lookup: Error (58 ms): getaddrinfo ENOTFOUND api.githubcopilot.com
- Proxy URL: None (11 ms)
- Electron fetch (configured): timed out after 10 seconds
- Node.js https: Error (193 ms): Error: getaddrinfo ENOTFOUND api.githubcopilot.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: Error (13 ms): TypeError: fetch failed
	at node:internal/deps/undici/undici:14902:13
	at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
	at async t._fetch (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5171:5228)
	at async t.fetch (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5171:4540)
	at async u (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5203:186)
	at async cg._executeContributedCommand (file:///c:/Users/parix/AppData/Local/Programs/Microsoft%20VS%20Code/cfbea10c5f/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:501:48675)
  Error: getaddrinfo ENOTFOUND api.githubcopilot.com
  	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Connecting to https://copilot-proxy.githubusercontent.com/_ping:
- DNS ipv4 Lookup: 52.175.140.176 (565 ms)
- DNS ipv6 Lookup: Error (71 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- Proxy URL: None (9 ms)
- Electron fetch (configured): timed out after 10 seconds
- Node.js https: Error (3088 ms): Error: getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: Error (35 ms): TypeError: fetch failed
	at node:internal/deps/undici/undici:14902:13
	at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
	at async t._fetch (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5171:5228)
	at async t.fetch (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5171:4540)
	at async u (c:\Users\parix\.vscode\extensions\github.copilot-chat-0.42.3\dist\extension.js:5203:186)
	at async cg._executeContributedCommand (file:///c:/Users/parix/AppData/Local/Programs/Microsoft%20VS%20Code/cfbea10c5f/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:501:48675)
  Error: getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
  	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Connecting to https://mobile.events.data.microsoft.com: timed out after 10 seconds
Connecting to https://dc.services.visualstudio.com: timed out after 10 seconds
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: Error (77 ms): Error: getaddrinfo ENOTFOUND copilot-telemetry.githubusercontent.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: Error (70 ms): Error: getaddrinfo ENOTFOUND copilot-telemetry.githubusercontent.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
Connecting to https://default.exp-tas.com: Error (78 ms): Error: getaddrinfo ENOTFOUND default.exp-tas.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Number of system certificates: 64

## Documentation

In corporate networks: [Troubleshooting firewall settings for GitHub Copilot](https://docs.github.com/en/copilot/troubleshooting-github-copilot/troubleshooting-firewall-settings-for-github-copilot).
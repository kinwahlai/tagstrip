// WSL2 (NAT networking) to Windows Chrome's DevTools port, for hardware WebGPU (TS-16 M2).
// WSL cannot reach Windows' 127.0.0.1, but Windows can reach WSL's (localhost forwarding), and an
// outbound connection needs no firewall rule. So for each client on --listen, this spawns a
// PowerShell pump on Windows that connects out to Chrome (127.0.0.1:--win-port) and back to
// --back here, and the two sockets are joined. One pump per client connection.
// Usage: node win-cdp-relay.mjs --win-port 9333 --listen 9402 --back 9401
import net from 'node:net'
import { spawn } from 'node:child_process'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const winPort = Number(args['win-port'] ?? 9333)
const listenPort = Number(args.listen ?? 9402)
const backPort = Number(args.back ?? 9401)

const pending = []
const back = net.createServer((sock) => {
  const waiter = pending.shift()
  if (!waiter) return sock.destroy()
  waiter(sock)
})
back.listen(backPort, '127.0.0.1')

const front = net.createServer((client) => {
  client.pause()
  const ps =
    `$c=New-Object Net.Sockets.TcpClient('127.0.0.1',${winPort});` +
    `$w=New-Object Net.Sockets.TcpClient('127.0.0.1',${backPort});` +
    `$a=$c.GetStream();$b=$w.GetStream();` +
    `$t1=$a.CopyToAsync($b);$t2=$b.CopyToAsync($a);` +
    `[Threading.Tasks.Task]::WaitAny($t1,$t2)|Out-Null;$c.Close();$w.Close()`
  const pump = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' })
  const timer = setTimeout(() => {
    console.error('relay: Windows pump did not connect back within 20 s')
    client.destroy()
    pump.kill()
  }, 20000)
  pending.push((sock) => {
    clearTimeout(timer)
    client.pipe(sock).pipe(client)
    client.resume()
    const end = () => {
      client.destroy()
      sock.destroy()
      pump.kill()
    }
    client.on('close', end)
    sock.on('close', end)
    client.on('error', end)
    sock.on('error', end)
  })
})
front.listen(listenPort, '127.0.0.1', () => console.log(`relay: listening on 127.0.0.1:${listenPort}`))

const FORK_COOKIE = "remix_fork";

function getCookie(request: Request, name: string): string | null {
  const part = (request.headers.get("Cookie") ?? "")
    .split(";")
    .find((value) => value.trim().startsWith(`${name}=`));
  return part ? decodeURIComponent(part.trim().slice(name.length + 1)) : null;
}

export function forkIdFrom(request: Request): string | null {
  const id = getCookie(request, FORK_COOKIE)?.trim().slice(0, 64);
  return id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}

import { authenticator } from "../auth.server";

export async function getAuthedUser(request: Request) {
  return await authenticator.isAuthenticated(request);
}

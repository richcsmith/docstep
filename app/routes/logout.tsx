import { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "./auth.server";
import { sessionStorage } from "./services/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await sessionStorage.getSession(
    request.headers.get("cookie")
  );
  await sessionStorage.destroySession(session);
  return await authenticator.logout(request, {
    redirectTo: "/login",
  });
}

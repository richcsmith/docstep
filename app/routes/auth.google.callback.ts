import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "./auth.server";

export const loader = ({ request }: LoaderFunctionArgs) => {
  return authenticator.authenticate("google", request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
};

import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { authenticator } from "./auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export async function loader({ request }: ActionFunctionArgs) {
  return await authenticator.isAuthenticated(request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
}

export default function Index() {
  return <h1 className="text-3xl font-bold mb-8">Video Frame Extractor</h1>;
}

import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { authenticator } from "./auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  console.log("logged in user :::::", user);
  if (user) {
    return user;
  } else {
    return redirect("/login");
  }
}

export default function Dashboard() {
  console.log("hello world");
  return (
    <div className="flex items-center justify-center h-screen w-screen">
      <h1 className="text-3xl font-bold">Dashboard</h1>
    </div>
  );
}

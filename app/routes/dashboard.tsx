import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import React, { Suspense } from "react";
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

const VideoFrameExtractionForm = React.lazy(
  () => import("~/components/VideoFrameExtractionForm.client")
);

export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl font-bold mb-8">Video Frame Extractor</h1>
      <Suspense fallback={<div>Loading video tools…</div>}>
        <VideoFrameExtractionForm />
      </Suspense>
    </div>
  );
}

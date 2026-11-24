// Daily Vercel Cron job (vercel.json): deletes expired demo users and expired sessions.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else gets a 401.
import { isAuthorizedCronRequest } from "@/features/demo/cron-auth";
import { deleteExpiredDemoUsers } from "@/features/demo/server";

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await deleteExpiredDemoUsers(new Date());
    console.info("cleanup-demo", result);
    return Response.json(result);
  } catch (error) {
    console.error("cleanup-demo failed", error);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

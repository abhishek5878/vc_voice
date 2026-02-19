import { redirect } from "next/navigation";

/** Passcode is now on the main auth page. Redirect. */
export default function PasscodePage() {
  redirect("/auth");
}

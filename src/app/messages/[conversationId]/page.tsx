/**
 * app/messages/[conversationId]/page.tsx
 *
 * This route is deprecated in favour of /messages which handles
 * conversation selection inline. Redirect cleanly.
 */
import { redirect } from "next/navigation";

export default function ConversationPage() {
  redirect("/messages");
}

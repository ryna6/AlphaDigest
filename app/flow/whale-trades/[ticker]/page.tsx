import { redirect } from "next/navigation";

export default function WhaleTradesTickerRedirect({ params }: { params: { ticker: string } }) {
  redirect(`/flow/whale-feed/${params.ticker.toUpperCase()}`);
}

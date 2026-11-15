import { db } from "./db";

// Questions the student asked about a topic (outside a lesson), with the answers given. Table topic_doubts.

// flagged: the student said the answer looks wrong. It stays on file, greyed out, and is shown to the parent.
export type TopicDoubt = { subject: string; topic: string; q: string; a: string; at: string; flagged?: boolean };

type Row = { subject: string; topic: string; q: string; a: string; at: string; flagged: boolean };

function fromRow(r: Row): TopicDoubt {
  const d: TopicDoubt = { subject: r.subject, topic: r.topic, q: r.q, a: r.a, at: r.at };
  if (r.flagged) d.flagged = true;
  return d;
}

export async function listTopicDoubts(): Promise<TopicDoubt[]> {
  const { data, error } = await db().from("topic_doubts").select("subject, topic, q, a, at, flagged").order("id");
  // A table that cannot be read must not look like "nothing was asked".
  if (error) throw new Error(`Could not read topic doubts: ${error.message}`);
  return (data as Row[]).map(fromRow);
}

export async function addTopicDoubt(d: TopicDoubt) {
  const { error } = await db()
    .from("topic_doubts")
    .insert({ subject: d.subject, topic: d.topic, q: d.q, a: d.a, at: d.at, flagged: Boolean(d.flagged) });
  if (error) throw new Error(`Could not save the question: ${error.message}`);
}

// "This looks wrong" on one answer, or taking that back. The answer is found by when it was given.
export async function flagTopicDoubt(subject: string, topic: string, at: string): Promise<boolean> {
  const { data, error } = await db()
    .from("topic_doubts")
    .select("id, flagged")
    .eq("subject", subject)
    .eq("topic", topic)
    .eq("at", at)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not read topic doubts: ${error.message}`);
  if (!data) return false;
  const { error: writeError } = await db().from("topic_doubts").update({ flagged: !data.flagged }).eq("id", data.id);
  if (writeError) throw new Error(`Could not save: ${writeError.message}`);
  return true;
}

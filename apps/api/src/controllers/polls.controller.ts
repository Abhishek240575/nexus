import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Create poll (attached to a post) ────────────────────────────────────────
export const createPoll = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { post_id, options, expires_hours = 24 } = req.body;

  if (!options || options.length < 2 || options.length > 4) {
    R.badRequest(res, 'Polls require 2-4 options'); return;
  }

  // Verify post ownership
  const { rows: post } = await db.query(
    'SELECT id FROM posts WHERE id = $1 AND user_id = $2',
    [post_id, userId]
  );
  if (!post[0]) { R.notFound(res, 'Post not found or not yours'); return; }

  const expires_at = new Date(Date.now() + expires_hours * 3600000);

  const { rows: poll } = await db.query(
    'INSERT INTO polls (post_id, expires_at) VALUES ($1, $2) RETURNING *',
    [post_id, expires_at]
  );

  const pollOptions = [];
  for (let i = 0; i < options.length; i++) {
    const { rows } = await db.query(
      'INSERT INTO poll_options (poll_id, label, position) VALUES ($1, $2, $3) RETURNING *',
      [poll[0].id, options[i], i + 1]
    );
    pollOptions.push(rows[0]);
  }

  R.created(res, { ...poll[0], options: pollOptions });
};

// ─── Get poll for a post ──────────────────────────────────────────────────────
export const getPoll = async (req: Request, res: Response): Promise<void> => {
  const { postId } = req.params;
  const userId     = (req as any).user?.id || null;

  const { rows: polls } = await db.query(
    'SELECT * FROM polls WHERE post_id = $1',
    [postId]
  );
  if (!polls[0]) { R.notFound(res, 'No poll for this post'); return; }
  const poll = polls[0];

  const { rows: options } = await db.query(
    'SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY position',
    [poll.id]
  );

  let userVote = null;
  if (userId) {
    const { rows: vote } = await db.query(
      'SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
      [poll.id, userId]
    );
    userVote = vote[0]?.option_id || null;
  }

  const totalVotes = options.reduce((sum: number, o: any) => sum + Number(o.votes_count), 0);
  const expired    = new Date(poll.expires_at) < new Date();

  R.ok(res, {
    ...poll,
    options: options.map((o: any) => ({
      ...o,
      percentage: totalVotes > 0 ? Math.round((o.votes_count / totalVotes) * 100) : 0,
    })),
    total_votes: totalVotes,
    user_vote:   userVote,
    expired,
  });
};

// ─── Vote on a poll ───────────────────────────────────────────────────────────
export const votePoll = async (req: Request, res: Response): Promise<void> => {
  const { id: userId }   = (req as AuthenticatedRequest).user;
  const { postId }       = req.params;
  const { option_id }    = req.body;

  const { rows: polls } = await db.query('SELECT * FROM polls WHERE post_id = $1', [postId]);
  if (!polls[0]) { R.notFound(res, 'Poll not found'); return; }
  const poll = polls[0];

  if (new Date(poll.expires_at) < new Date()) {
    R.badRequest(res, 'Poll has expired'); return;
  }

  const alreadyVoted = await db.query(
    'SELECT id FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
    [poll.id, userId]
  );
  if (alreadyVoted.rows[0]) { R.conflict(res, 'Already voted'); return; }

  const { rows: opt } = await db.query(
    'SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2',
    [option_id, poll.id]
  );
  if (!opt[0]) { R.badRequest(res, 'Invalid option'); return; }

  await db.query(
    'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)',
    [poll.id, option_id, userId]
  );

  R.ok(res, { voted: true, option_id });
};

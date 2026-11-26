import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  HttpError,
  addMember,
  castVote,
  closePoll,
  createMonthly,
  createWeekly,
  getMember,
  openVoting,
  removeEntry,
  submitEntry,
  viewPoll,
  viewPollDetail,
} from '../competition';
import type { JsonStore } from '../store';

export interface CompetitionOptions {
  store: JsonStore;
  uploadsDir: string;
  adminPasscode: string;
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};

export function competitionRouter({
  store,
  uploadsDir,
  adminPasscode,
}: CompetitionOptions): Router {
  const db = store.db;
  fs.mkdirSync(uploadsDir, { recursive: true });

  // Random file names, so a photo's URL never reveals who uploaded it.
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${IMAGE_TYPES[file.mimetype]}`),
    }),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (IMAGE_TYPES[file.mimetype]) cb(null, true);
      else cb(new HttpError(400, 'Photo must be a JPEG, PNG, WebP, GIF or HEIC image'));
    },
  });

  const deletePhoto = (file: string): void => {
    // Monthly and tie-break entries reuse the weekly file; only delete unused ones.
    if (!db.entries.some((e) => e.photo === file)) {
      fs.rm(path.join(uploadsDir, file), { force: true }, () => undefined);
    }
  };

  const id = (req: Request): string => String(req.params.id);
  /** A string field from the JSON or form body; anything else counts as empty. */
  const field = (req: Request, name: string): string => {
    const value = (req.body as Record<string, unknown> | undefined)?.[name];
    return typeof value === 'string' ? value : '';
  };
  const memberId = (req: Request): string | undefined => req.header('x-member-id') ?? undefined;

  const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.header('x-admin-passcode') !== adminPasscode)
      throw new HttpError(401, 'Wrong admin passcode');
    next();
  };

  const router = Router();

  router.use('/photos', express.static(uploadsDir, { fallthrough: false, maxAge: '7d' }));

  // ---- members
  router.get('/members', (_req, res) => {
    res.json([...db.members].sort((a, b) => a.name.localeCompare(b.name)));
  });

  router.post('/members', (req, res) => {
    const member = addMember(db, field(req, 'name'));
    store.save();
    res.status(201).json(member);
  });

  // ---- polls
  router.get('/polls', (_req, res) => {
    const polls = [...db.polls].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(polls.map((p) => viewPoll(db, p)));
  });

  router.get('/polls/:id', (req, res) => {
    res.json(viewPollDetail(db, id(req), memberId(req)));
  });

  router.post('/polls/:id/entries', (req, res, next) => {
    upload.single('photo')(req, res, (err: unknown) => {
      if (err)
        return next(err instanceof multer.MulterError ? new HttpError(400, err.message) : err);
      try {
        if (!req.file) throw new HttpError(400, 'Attach a photo');
        const member = getMember(db, memberId(req));
        const caption = field(req, 'caption');
        const { replacedPhoto } = submitEntry(db, id(req), member.id, req.file.filename, caption);
        store.save();
        if (replacedPhoto) deletePhoto(replacedPhoto);
        res.status(201).json(viewPollDetail(db, id(req), member.id));
      } catch (e) {
        if (req.file) fs.rm(req.file.path, { force: true }, () => undefined);
        next(e);
      }
    });
  });

  router.post('/polls/:id/vote', (req, res) => {
    const member = getMember(db, memberId(req));
    castVote(db, id(req), member.id, field(req, 'entryId'));
    store.save();
    res.json(viewPollDetail(db, id(req), member.id));
  });

  // ---- admin
  router.post('/admin/check', requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });

  router.post('/polls/weekly', requireAdmin, (req, res) => {
    const poll = createWeekly(db, field(req, 'weekOf'), field(req, 'theme') || undefined);
    store.save();
    res.status(201).json(viewPoll(db, poll));
  });

  router.post('/polls/monthly', requireAdmin, (req, res) => {
    const poll = createMonthly(db, field(req, 'month'));
    store.save();
    res.status(201).json(viewPoll(db, poll));
  });

  router.post('/polls/:id/open-voting', requireAdmin, (req, res) => {
    openVoting(db, id(req));
    store.save();
    res.json(viewPollDetail(db, id(req), memberId(req)));
  });

  router.post('/polls/:id/close', requireAdmin, (req, res) => {
    const { tiebreak } = closePoll(db, id(req));
    store.save();
    res.json({ poll: viewPollDetail(db, id(req), memberId(req)), tiebreakId: tiebreak?.id });
  });

  router.delete('/entries/:id', requireAdmin, (req, res) => {
    const photo = removeEntry(db, id(req));
    store.save();
    deletePhoto(photo);
    res.status(204).end();
  });

  return router;
}

/** Sends `HttpError`s (and bad JSON bodies) as `{ error }` with the right status. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const status =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 404 ? 'Not found' : 'Bad request' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

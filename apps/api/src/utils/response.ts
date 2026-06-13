import { Response } from 'express';
import { ApiResponse } from '../types';

export const ok = <T>(res: Response, data: T, message?: string): Response =>
  res.status(200).json({ success: true, data, message } as ApiResponse<T>);

export const created = <T>(res: Response, data: T, message?: string): Response =>
  res.status(201).json({ success: true, data, message } as ApiResponse<T>);

export const noContent = (res: Response): Response =>
  res.status(204).send();

export const badRequest = (res: Response, error: string): Response =>
  res.status(400).json({ success: false, error } as ApiResponse);

export const unauthorized = (res: Response, error = 'Unauthorized'): Response =>
  res.status(401).json({ success: false, error } as ApiResponse);

export const forbidden = (res: Response, error = 'Forbidden'): Response =>
  res.status(403).json({ success: false, error } as ApiResponse);

export const notFound = (res: Response, error = 'Not found'): Response =>
  res.status(404).json({ success: false, error } as ApiResponse);

export const conflict = (res: Response, error: string): Response =>
  res.status(409).json({ success: false, error } as ApiResponse);

export const serverError = (res: Response, error = 'Internal server error'): Response =>
  res.status(500).json({ success: false, error } as ApiResponse);

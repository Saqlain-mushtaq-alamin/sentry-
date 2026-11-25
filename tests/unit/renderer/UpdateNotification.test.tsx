// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UpdateNotification } from '../../../src/renderer/components/UpdateNotification';

describe('UpdateNotification (Phase 16 - Task 16.4)', () => {
  let statusCallback: ((status: any) => void) | null = null;
  const mockDownloadUpdate = vi.fn().mockResolvedValue({ state: 'downloading' });
  const mockInstallUpdate = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    statusCallback = null;
    localStorage.clear();
    mockDownloadUpdate.mockClear();
    mockInstallUpdate.mockClear();

    (window as any).sentry = {
      updater: {
        downloadUpdate: mockDownloadUpdate,
        installUpdate: mockInstallUpdate,
        onUpdateStatus: vi.fn((cb) => {
          statusCallback = cb;
          return () => {
            statusCallback = null;
          };
        }),
      },
    };
  });

  it('renders nothing when state is idle or checking', () => {
    const { container } = render(<UpdateNotification />);
    expect(container.firstChild).toBeNull();

    act(() => {
      statusCallback?.({ state: 'checking' });
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders update notification banner with version and release notes when update is available', () => {
    render(<UpdateNotification />);

    act(() => {
      statusCallback?.({
        state: 'available',
        version: '1.1.0',
        releaseNotes: '• Improved injection detection accuracy\n• New recipe sharing feature',
      });
    });

    expect(screen.getByText(/Update Available: v1.1.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Improved injection detection accuracy/i)).toBeInTheDocument();
    expect(screen.getByText(/New recipe sharing feature/i)).toBeInTheDocument();
  });

  it('triggers download when Download & Install button is clicked', () => {
    render(<UpdateNotification />);

    act(() => {
      statusCallback?.({
        state: 'available',
        version: '1.1.0',
      });
    });

    const downloadBtn = screen.getByRole('button', { name: /Download & Install/i });
    fireEvent.click(downloadBtn);

    expect(mockDownloadUpdate).toHaveBeenCalled();
  });

  it('shows progress bar during download', () => {
    render(<UpdateNotification />);

    act(() => {
      statusCallback?.({
        state: 'downloading',
        version: '1.1.0',
        percent: 65,
      });
    });

    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText(/Downloading update.../i)).toBeInTheDocument();
  });

  it('shows Restart Now when update is downloaded', () => {
    render(<UpdateNotification />);

    act(() => {
      statusCallback?.({
        state: 'downloaded',
        version: '1.1.0',
      });
    });

    expect(screen.getByText(/Update Ready: v1.1.0/i)).toBeInTheDocument();
    const restartBtn = screen.getByRole('button', { name: /Restart Now/i });
    fireEvent.click(restartBtn);

    expect(mockInstallUpdate).toHaveBeenCalled();
  });

  it('skips version and persists to localStorage when Skip is clicked', () => {
    render(<UpdateNotification />);

    act(() => {
      statusCallback?.({
        state: 'available',
        version: '1.2.0',
      });
    });

    const skipBtn = screen.getByRole('button', { name: /Skip/i });
    fireEvent.click(skipBtn);

    expect(localStorage.getItem('sentry_skipped_version')).toBe('1.2.0');
    expect(screen.queryByText(/Update Available/i)).toBeNull();
  });

  it('dismisses temporarily when Later is clicked', () => {
    const onDismiss = vi.fn();
    render(<UpdateNotification onDismiss={onDismiss} />);

    act(() => {
      statusCallback?.({
        state: 'available',
        version: '1.3.0',
      });
    });

    const laterBtn = screen.getByRole('button', { name: /Later/i });
    fireEvent.click(laterBtn);

    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText(/Update Available/i)).toBeNull();
  });
});

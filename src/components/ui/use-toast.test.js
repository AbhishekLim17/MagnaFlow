import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast, useToast } from './use-toast';
import { renderHook, act } from '@testing-library/react';

// The store is module-level, so each test renders one subscriber and drains
// anything a previous test left behind.
let result;
const titles = () => result.current.toasts.map((t) => t.title);

beforeEach(() => {
  vi.useFakeTimers();
  ({ result } = renderHook(() => useToast()));
  act(() => {
    result.current.toasts.forEach((t) => t.dismiss());
  });
});

afterEach(() => {
  act(() => {
    result.current.toasts.forEach((t) => t.dismiss());
  });
  vi.useRealTimers();
});

describe('toast store', () => {
  // The limit used to be 1, so a second message instantly erased the first —
  // a save failing for two reasons showed only one, and a success toast could
  // wipe an error the user had not read.
  test('keeps several toasts instead of replacing the previous one', () => {
    act(() => {
      toast({ title: 'First' });
      toast({ title: 'Second' });
    });
    expect(titles()).toEqual(['Second', 'First']);
  });

  test('caps the stack so toasts cannot pile up without bound', () => {
    act(() => {
      for (let i = 0; i < 6; i++) toast({ title: `T${i}` });
    });
    expect(result.current.toasts).toHaveLength(3);
  });

  test('auto-dismisses after its duration', () => {
    act(() => {
      toast({ title: 'Bye', duration: 4000 });
    });
    expect(titles()).toEqual(['Bye']);
    act(() => vi.advanceTimersByTime(4001));
    expect(titles()).toEqual([]);
  });

  // Guards the reason the timers had to move out of useToast's effect: that
  // effect recreated every timer whenever the array changed, so with more than
  // one toast allowed, an older toast's countdown would restart each time a
  // new one arrived and it would outstay its duration.
  test("a new toast does not restart an existing toast's countdown", () => {
    act(() => {
      toast({ title: 'Old', duration: 5000 });
    });
    act(() => vi.advanceTimersByTime(4000));
    act(() => {
      toast({ title: 'New', duration: 5000 });
    });
    act(() => vi.advanceTimersByTime(1001));

    expect(titles()).toEqual(['New']);
  });

  test('an error stays up longer than a success', () => {
    act(() => {
      toast({ title: 'Saved' });
      toast({ title: 'Failed', duration: 9000 });
    });
    act(() => vi.advanceTimersByTime(5001));
    expect(titles()).toEqual(['Failed']);
  });

  test('duration Infinity stays until dismissed', () => {
    let handle;
    act(() => {
      handle = toast({ title: 'Sticky', duration: Infinity });
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(titles()).toEqual(['Sticky']);

    act(() => handle.dismiss());
    expect(titles()).toEqual([]);
  });

  test('dismiss removes the toast from the store', () => {
    let handle;
    act(() => {
      handle = toast({ title: 'Manual' });
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => handle.dismiss());
    expect(result.current.toasts).toHaveLength(0);
  });

  test('update changes a toast in place', () => {
    let handle;
    act(() => {
      handle = toast({ title: 'Before' });
    });
    act(() => handle.update({ title: 'After' }));
    expect(titles()).toEqual(['After']);
  });
});

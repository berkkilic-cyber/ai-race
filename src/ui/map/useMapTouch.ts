import { useLayoutEffect, useMemo, useRef } from 'react';
import { Platform, type GestureResponderEvent, type HostInstance, type LayoutChangeEvent, type NativeTouchEvent, type ViewProps, type ViewStyle } from 'react-native';

import { noteCallback, recordTouch, touchDebugInfo } from './touchDebug';
import { TouchController, type TouchHooks, type TouchPoint } from './touchController';

type ResponderProps = Pick<
  ViewProps,
  | 'onStartShouldSetResponder'
  | 'onMoveShouldSetResponder'
  | 'onResponderGrant'
  | 'onResponderStart'
  | 'onResponderMove'
  | 'onResponderEnd'
  | 'onResponderRelease'
  | 'onResponderTerminate'
  | 'onResponderTerminationRequest'
  | 'onLayout'
>;

/** Web: the browser must not pan or pinch-zoom the page over the map (that steals and distorts the touches). Spread into the touch view's style. */
export const WEB_TOUCH = Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle) : null;

export interface MapTouch {
  /** Spread onto the touch view: a plain, non-collapsable View that fills the map and has no children. Includes its ref. */
  props: ResponderProps & { ref: (node: HostInstance | null) => void };
}

/**
 * Map touches through React Native's core responder system (the same system as every
 * Pressable, so it works wherever buttons work). The touch view claims every touch that
 * starts on it and never gives it up; each event's touches are converted to touch-view
 * coordinates and handed to the TouchController.
 *
 * Coordinates: at the grant, the touch view's page origin is taken from the event itself
 * (pageX - locationX of the touch that started on this childless view), then every touch of
 * the gesture is pageX/pageY minus that origin. This needs no measuring, holds for every
 * finger of a pinch (locationX of a second touch can be relative to another view), and is
 * the same space as the view transform (the touch view is not transformed). The origin from
 * measureInWindow is recorded beside it for the debug overlay.
 */
export function useMapTouch(name: string, hooks: TouchHooks): MapTouch {
  const hooksRef = useRef(hooks);
  useLayoutEffect(() => {
    hooksRef.current = hooks;
  });
  const controllerRef = useRef<TouchController | null>(null);
  const nodeRef = useRef<HostInstance | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const props = useMemo<MapTouch['props']>(() => {
    /** The controller, made on the first touch (event handlers only, never during render). */
    const controller = () =>
      (controllerRef.current ??= new TouchController({
        layout: () => hooksRef.current.layout(),
        view: () => hooksRef.current.view(),
        setView: (v) => hooksRef.current.setView(v),
        tap: (x, y) => {
          recordTouch({ taps: touchDebugInfo().taps + 1 });
          hooksRef.current.tap(x, y);
        },
        doubleTap: (x, y) => hooksRef.current.doubleTap(x, y),
        begin: () => hooksRef.current.begin?.(),
        gestureEnd: (k, v) => hooksRef.current.gestureEnd?.(k, v),
      }));
    const measure = () => {
      const node = nodeRef.current as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
      try {
        node?.measureInWindow?.((x, y, w, h) => recordTouch({ measured: { x, y }, layout: { w, h } }));
      } catch {
        // measuring is for diagnostics only
      }
    };
    const points = (list: readonly NativeTouchEvent[] | undefined): TouchPoint[] =>
      (list ?? []).map((t) => ({ id: Number(t.identifier) || 0, x: t.pageX - origin.current.x, y: t.pageY - origin.current.y }));
    const note = (cb: string, e: GestureResponderEvent) => {
      const ne = e.nativeEvent;
      noteCallback(cb);
      recordTouch({
        map: name,
        raw: { pageX: ne.pageX, pageY: ne.pageY, locationX: ne.locationX, locationY: ne.locationY },
        local: { x: ne.pageX - origin.current.x, y: ne.pageY - origin.current.y },
        touches: ne.touches?.length ?? 0,
        list: points(ne.touches)
          .map((p) => `${p.id}:${Math.round(p.x)},${Math.round(p.y)}`)
          .join(' '),
        phase: controller().phase,
        view: hooksRef.current.view(),
      });
    };
    const now = (e: GestureResponderEvent) => {
      // Event timestamps (ms; the clock differs by platform, but only differences are used).
      const ts = Number(e.nativeEvent.timestamp);
      return Number.isFinite(ts) && ts > 0 ? ts : Date.now();
    };
    return {
      ref: (node: HostInstance | null) => {
        nodeRef.current = node;
      },
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderTerminationRequest: () => false,
      onResponderGrant: (e) => {
        const ne = e.nativeEvent;
        const ox = ne.pageX - ne.locationX;
        const oy = ne.pageY - ne.locationY;
        if (Number.isFinite(ox) && Number.isFinite(oy)) origin.current = { x: ox, y: oy };
        recordTouch({ origin: { ...origin.current } });
        controller().begin(points(ne.touches?.length ? ne.touches : [ne]), now(e));
        note('grant', e);
        measure();
      },
      onResponderStart: (e) => {
        controller().update(points(e.nativeEvent.touches), now(e));
        note('start', e);
      },
      onResponderMove: (e) => {
        controller().update(points(e.nativeEvent.touches), now(e));
        note('move', e);
      },
      onResponderEnd: (e) => {
        // A finger lifted while others stay down (the last one also reaches onResponderRelease).
        if ((e.nativeEvent.touches?.length ?? 0) > 0) controller().update(points(e.nativeEvent.touches), now(e));
        note('end', e);
      },
      onResponderRelease: (e) => {
        const ne = e.nativeEvent;
        const changed = points(ne.changedTouches?.length ? ne.changedTouches : [ne]);
        note('release', e);
        controller().release(changed[0] ?? null, now(e));
        recordTouch({ phase: controller().phase, touches: 0, list: '', view: hooksRef.current.view() });
      },
      onResponderTerminate: (e) => {
        note('terminate', e);
        controller().cancel();
      },
      onLayout: (_e: LayoutChangeEvent) => measure(),
    };
  }, [name]);

  return { props };
}

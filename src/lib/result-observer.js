// Poll only while data is incomplete. Socket events can request an earlier read;
// reads never overlap and disposed views cannot receive a late response.
export function observeResult({load, onData, onError, isPending, interval = 1500}) {
  let stopped = false, busy = false, refreshRequested = false, timer, controller, failures = 0;
  async function refresh() {
    if (stopped) return;
    if (busy) {refreshRequested = true; return;}
    clearTimeout(timer);
    busy = true;
    controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 15000);
    let again = false;
    try {
      const data = await load(controller.signal);
      if (stopped) return;
      failures = 0;
      onData(data);
      again = isPending(data);
    } catch (error) {
      if (stopped) return;
      failures++;
      again = failures < 3;
      onError(error, again);
    } finally {
      clearTimeout(deadline);
      busy = false;
      if (!stopped && again) timer = setTimeout(refresh, refreshRequested ? 0 : interval);
      refreshRequested = false;
    }
  }
  void refresh();
  return {refresh, stop() {stopped = true; clearTimeout(timer); controller?.abort();}};
}

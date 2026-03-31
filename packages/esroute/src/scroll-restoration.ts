import { NavOpts } from "./nav-opts";

export const restoreHandling = ({
  container = document.scrollingElement ?? document.body,
  find = (hash: string) => document.getElementById(hash),
  offset = 0,
  hashScroll = true,
  stateProp = "__scroll",
}: {
  container?: Element;
  find?: (hash: string) => Element | undefined | null;
  offset?: number;
  hashScroll?: boolean;
  stateProp?: string;
} = {}) => {
  history.scrollRestoration = "manual";
  const save = () =>
    history.replaceState(
      { ...history.state, [stateProp]: container.scrollTop },
      "",
      location.href
    );
  const set = (val?: number) => {
    if (typeof val === "number") container.scrollTop = val;
  };
  const getStatePos = () =>
    (history.state && history.state[stateProp]) ?? undefined;
  const getHashPos =
    hashScroll &&
    ((hash: string) =>
      (find(hash)?.getBoundingClientRect().top ?? 0) -
      offset +
      container.scrollTop);

  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", save);
  window.addEventListener("popstate", () => set(getStatePos()));
  return ({ opts: { hash, pop } }: { opts: NavOpts }) => {
    const fromState = getStatePos();
    if (fromState) return set(fromState);
    if (!fromState && hash && getHashPos) return set(getHashPos(hash));
    container.scrollTop = 0;
  };
};

const WIDTH = 600;
export const popupCenter = (url, title) => {
  const dualScreenLeft = window.screenLeft ?? window.screenX;
  const dualScreenTop = window.screenTop ?? window.screenY;

  const width =
    window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;

  const height =
    window.innerHeight ??
    document.documentElement.clientHeight ??
    screen.height;

  const systemZoom = width / window.screen.availWidth;

  const left = (width - WIDTH) / 2 / systemZoom + dualScreenLeft;
  const top = (height - WIDTH) / 2 / systemZoom + dualScreenTop;

  const newWindow = window.open(
    url,
    title,
    `width=${WIDTH / systemZoom},height=${
      WIDTH + 100 / systemZoom
    },top=${top},left=${left}`
  );

  newWindow?.focus();
};

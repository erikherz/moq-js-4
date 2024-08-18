/* eslint-disable jsx-a11y/media-has-caption */
import { Player } from "@kixelated/moq/playback";
import { createEffect, createSignal, onCleanup } from "solid-js";

export default function Watch(props: { name: string }) {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlSearchParams.entries());
    const server = params.server ?? import.meta.env.PUBLIC_RELAY_HOST;
    const [error, setError] = createSignal<Error | undefined>();
    let canvas!: HTMLCanvasElement;
    const [usePlayer, setPlayer] = createSignal<Player | undefined>();

    createEffect(() => {
        const namespace = props.name;
        const url = `https://${server}`;
        const fingerprint = server.startsWith("localhost") ? `https://${server}/fingerprint` : undefined;
        Player.create({ url, fingerprint, canvas, namespace }).then(setPlayer).catch(setError);
    });

    createEffect(() => {
        const player = usePlayer();
        if (!player) return;
        onCleanup(() => player.close());
        player.closed().then(setError).catch(setError);
    });

    const play = () => usePlayer()?.play();
    const loadScript = (src: string, onLoad: () => void) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onLoad;
        script.onerror = () => console.error(`Failed to load script: ${src}`);
        document.head.appendChild(script);
    };

    createEffect(() => {
        if (error()) {
            console.log("Error detected:", error());
            const namespace = props.name;
            const videoHTML = `
                <div style="width: 1280px; height: 720px;">
                    <video
                        id="vivoh_player"
                        class="video-js"
                        controls
                        preload="auto"
                        width="1280"
                        height="720"
                        data-setup='{"liveui": true, "playbackRates": [1], "controlBar": {"pictureInPictureToggle": false}}'
                        style="width: 100%; height: 100%;"
                    >
                        <source id="video-source" src="https://norcal-hls.vivoh.earth/live/${namespace}/index.m3u8" type="application/x-mpegURL" />
                    </video>
                </div>
            `;
            const container = document.createElement('div');
            container.innerHTML = videoHTML;
            console.log("Injecting video HTML content");

            // Ensure the styles are loaded
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/home/video-js.css';
            document.head.appendChild(link);
            console.log("Appended stylesheet link to document head");

            // Replace the canvas with the video container
            canvas.replaceWith(container);
            console.log("Replaced canvas with video container");

            // Minimal logging for video element
            const videoElement = container.querySelector('#vivoh_player') as HTMLVideoElement;
            if (videoElement) {
                videoElement.addEventListener('error', (event) => {
                    console.error('Video error:', event);
                });
                videoElement.addEventListener('loadedmetadata', () => {
                    console.log('Video metadata loaded');
                });
                console.log('Video element created:', videoElement);

                // Dynamically load video.js and initialize the player
                loadScript('/home/video.min.js', () => {
                    console.log('video.js script loaded');
                    const videoJS = (window as any).videojs;
                    if (videoJS) {
                        const playerInstance = videoJS(videoElement);
                        console.log('video.js player instance created:', playerInstance);
                    } else {
                        console.error('video.js library not found after script load');
                    }
                });
            } else {
                console.error('Failed to create video element');
            }
        }
    });

    return (
        <>
            <canvas ref={canvas} onClick={play} class="aspect-video w-full rounded-lg" />
        </>
    );
}

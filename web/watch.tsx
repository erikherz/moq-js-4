import { Player } from "@kixelated/moq/playback"
import { Client, Connection } from "@kixelated/moq/transport"
import { Catalog } from "@kixelated/moq/media"

import { createEffect, onCleanup, Show } from "solid-js"
import { useParams, useSearchParams } from "@solidjs/router"

import { createRunner } from "./common"
import { Listing } from "./listing"

export function Watch() {
	const params = useParams<{ name: string }>()
	const [query] = useSearchParams<{ server?: string }>()

	const namespace = params.name
	const server = query.server ?? process.env.RELAY_HOST

	const connection = createRunner<Connection, string>(async (setConnection, server) => {
		const url = `https://${server}`

		// Special case localhost to fetch the TLS fingerprint from the server.
		// TODO remove this when WebTransport correctly supports self-signed certificates
		const fingerprint = server.startsWith("localhost") ? url + "/fingerprint" : undefined

		const client = new Client({
			url: `https://${server}`,
			fingerprint,
			role: "subscriber",
		})

		const connection = await client.connect()
		setConnection(connection)

		throw await connection.closed()
	}, server)

	createEffect(() => {
		// Close the connection when the component is unmounted.
		onCleanup(() => connection()?.close())
	})

	const player = createRunner<Player, Connection>(async (ready, connection) => {
		// TODO move the catalog fetch into the player
		const catalog = await Catalog.fetch(connection, namespace)
		const player = new Player({ connection, namespace, catalog })

		ready(player)

		throw await player.closed()
	}, connection)

	// Render the canvas when the DOM is inserted
	let canvas: HTMLCanvasElement
	createEffect(() => player()?.attach(canvas))

	// Report errors to terminal too so we'll get stack traces
	createEffect(() => {
		if (player.error()) console.error(player.error())
	})

	// NOTE: The canvas automatically has width/height set to the decoded video size.
	// TODO shrink it if needed via CSS
	return (
		<>
			<Show when={player.error()}>
				<div class="rounded-md bg-red-600 px-4 py-2 font-bold">
					{player.error()!.name}: {player.error()!.message}
				</div>
			</Show>
			<Listing server={server} name={params.name} catalog={player()?.catalog} />
			<canvas ref={canvas!} class="rounded-md" />
		</>
	)
}

/*
function Buffer(props: { player: Player }) {
	const [timeline, setTimeline] = createSignal<Timeline>({ audio: { buffer: [] }, video: { buffer: [] } })

	createEffect(async () => {
		for await (const timeline of props.player.timeline()) {
			setTimeline(timeline)
		}
	})

	const playhead = createMemo(() => {
		return timeline().timestamp ?? 0
	})

	const bounds = createMemo(() => {
		const maxEnd = (ranges: Range[]) => {
			return ranges.reduce((max, range) => Math.max(max, range.end), 0)
		}

		const start = Math.max(playhead() - 2, 0)
		const end =
			Math.max(
				maxEnd(timeline().audio.buffer) + 1,
				maxEnd(timeline().video.buffer) + 1,
				playhead() + 3,
				start + 4
			) + 1
		return { start, end }
	})

	// Converts a value from to a 0-100 range based on the bounds.
	const asPercent = (value: number) => {
		return (100 * (value - bounds().start)) / (bounds().end - bounds().start)
	}

	const click = (e: MouseEvent) => {
		e.preventDefault()

		const rect = (e.target as HTMLElement).getBoundingClientRect()
		const pos = (e.clientX - rect.left) / rect.width // 0 - 1

		const timestamp = bounds().start + pos * (bounds().end - bounds().start)
		props.player.seek(timestamp)
	}

	// Called for both audio and video
	const Component = (props: { ranges: Range[] }) => {
		return (
			<div class="relative basis-1/2">
				<For each={props.ranges}>
					{(range) => {
						return (
							<div
								class="absolute bottom-0 top-0 bg-indigo-500 transition-pos"
								style={{
									left: `${asPercent(range.start)}%`,
									width: `${asPercent(range.end) - asPercent(range.start)}%`,
								}}
							></div>
						)
					}}
				</For>
			</div>
		)
	}

	const Legend = () => {
		const boundsRounded = createMemo(() => {
			return { start: Math.floor(bounds().start), end: Math.ceil(bounds().end) }
		})

		// Write the timestamp each second.
		const breakpoints = createMemo(() => {
			const bounds = boundsRounded()

			const breakpoints = []
			for (let i = bounds.start; i <= bounds.end; i++) {
				breakpoints.push(i)
			}

			return breakpoints
		})

		return (
			<For each={breakpoints()}>
				{(breakpoint) => {
					return (
						<div
							class="absolute bottom-0 top-0 text-sm text-white transition-pos"
							style={{ left: `${asPercent(breakpoint)}%` }}
						>
							{breakpoint}
						</div>
					)
				}}
			</For>
		)
	}

	const Playhead = () => {
		return (
			<div
				class="absolute bottom-0 top-0 w-1 bg-indigo-50/50 transition-pos"
				style={{
					left: `${asPercent(playhead())}%`,
				}}
			></div>
		)
	}

	return (
		<div class="transition-height relative flex h-6 flex-col duration-100" onClick={click}>
			<Component ranges={timeline().audio.buffer} />
			<Component ranges={timeline().video.buffer} />
			<Legend />
			<Playhead />
		</div>
	)
}
*/

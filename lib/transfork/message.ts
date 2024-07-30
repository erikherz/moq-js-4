import { Reader, Writer } from "./stream"

export type Role = "publisher" | "subscriber" | "both"

export enum Version {
	DRAFT_00 = 0xff000000,
	DRAFT_01 = 0xff000001,
	DRAFT_02 = 0xff000002,
	DRAFT_03 = 0xff000003,
	FORK_00 = 0xff0bad00,
}

export class Extensions {
	entries: Map<bigint, Uint8Array>

	constructor() {
		this.entries = new Map()
	}

	set(id: bigint, value: Uint8Array) {
		this.entries.set(id, value)
	}

	get(id: bigint): Uint8Array | undefined {
		return this.entries.get(id)
	}

	remove(id: bigint): Uint8Array | undefined {
		const value = this.entries.get(id)
		this.entries.delete(id)
		return value
	}

	async encode(w: Writer) {
		await w.u53(this.entries.size)
		for (const [id, value] of this.entries) {
			await w.u62(id)
			await w.u53(value.length)
			await w.write(value)
		}
	}

	static async decode(r: Reader): Promise<Extensions> {
		const count = await r.u53()
		const params = new Extensions()

		for (let i = 0; i < count; i++) {
			const id = await r.u62()
			const size = await r.u53()
			const value = await r.read(size)

			if (params.entries.has(id)) {
				throw new Error(`duplicate parameter id: ${id}`)
			}

			params.entries.set(id, value)
		}

		return params
	}
}

export enum Order {
	Any = 0,
	Ascending = 1,
	Descending = 2,
}

export class SessionClient {
	versions: Version[]
	role: Role
	extensions: Extensions

	static StreamID = 0x0

	constructor(versions: Version[], role: Role, extensions = new Extensions()) {
		this.versions = versions
		this.role = role
		this.extensions = extensions
	}

	async encode(w: Writer) {
		await w.u53(this.versions.length)
		for (const v of this.versions) {
			await w.u53(v)
		}

		const role = new Uint8Array([this.role == "publisher" ? 1 : this.role == "subscriber" ? 2 : 3])
		this.extensions.set(0n, role)

		await this.extensions.encode(w)
	}

	static async decode(r: Reader): Promise<SessionClient> {
		const versions = []
		const count = await r.u53()
		for (let i = 0; i < count; i++) {
			versions.push(await r.u53())
		}

		const extensions = await Extensions.decode(r)
		const role = decodeRole(extensions.get(0n))

		return new SessionClient(versions, role, extensions)
	}
}

export class SessionServer {
	version: Version
	role: Role
	extensions: Extensions

	constructor(version: Version, role: Role, extensions = new Extensions()) {
		this.version = version
		this.role = role
		this.extensions = extensions
	}

	async encode(w: Writer) {
		await w.u53(this.version)

		const role = new Uint8Array([this.role == "publisher" ? 1 : this.role == "subscriber" ? 2 : 3])
		this.extensions.set(0n, role)

		await this.extensions.encode(w)
	}

	static async decode(r: Reader): Promise<SessionServer> {
		const version = await r.u53()
		const extensions = await Extensions.decode(r)
		const role = decodeRole(extensions.get(0n))

		return new SessionServer(version, role, extensions)
	}
}

export class SessionInfo {
	bitrate: number

	constructor(bitrate: number) {
		this.bitrate = bitrate
	}

	async encode(w: Writer) {
		await w.u53(this.bitrate)
	}

	static async decode(r: Reader): Promise<SessionInfo> {
		const bitrate = await r.u53()
		return new SessionInfo(bitrate)
	}

	static async decode_maybe(r: Reader): Promise<SessionInfo | undefined> {
		if (await r.done()) return
		return await SessionInfo.decode(r)
	}
}

export class Announce {
	broadcast: string

	static StreamID = 0x1

	constructor(broadcast: string) {
		this.broadcast = broadcast
	}

	async encode(w: Writer) {
		await w.string(this.broadcast)
	}

	static async decode(r: Reader): Promise<Announce> {
		return new Announce(await r.string())
	}
}

export class AnnounceOk {
	cool = true

	static async encode(w: Writer) {
		await w.u53(1)
	}

	static async decode(r: Reader): Promise<AnnounceOk> {
		if ((await r.u53()) != 1) {
			throw new Error("invalid cool")
		}

		return new AnnounceOk()
	}
}

export class SubscribeUpdate {
	priority: number
	order = Order.Any
	expires = 0 // ms

	start?: bigint
	end?: bigint

	constructor(priority: number) {
		this.priority = priority
	}

	async encode(w: Writer) {
		await w.u53(this.priority)
		await w.u53(this.order)
		await w.u53(this.expires)
		await w.u62(this.start ? this.start + 1n : 0n)
		await w.u62(this.end ? this.end + 1n : 0n)
	}

	static async decode(r: Reader): Promise<SubscribeUpdate> {
		const priority = await r.u53()
		const order = await r.u53()
		if (order > 2) {
			throw new Error(`invalid order: ${order}`)
		}

		const expires = await r.u53()
		const start = await r.u62()
		const end = await r.u62()

		const update = new SubscribeUpdate(priority)
		update.order = order
		update.expires = expires
		update.start = start == 0n ? undefined : start - 1n
		update.end = end == 0n ? undefined : end - 1n

		return update
	}

	static async decode_maybe(r: Reader): Promise<SubscribeUpdate | undefined> {
		if (await r.done()) return
		return await SubscribeUpdate.decode(r)
	}
}

export class Subscribe extends SubscribeUpdate {
	id: bigint
	broadcast: string
	track: string

	static StreamID = 0x2

	constructor(id: bigint, broadcast: string, track: string, priority: number) {
		super(priority)

		this.id = id
		this.broadcast = broadcast
		this.track = track
	}

	async encode(w: Writer) {
		await w.u62(this.id)
		await w.string(this.broadcast)
		await w.string(this.track)
		await super.encode(w)
	}

	static async decode(r: Reader): Promise<Subscribe> {
		const id = await r.u62()
		const broadcast = await r.string()
		const track = await r.string()
		const update = await super.decode(r)

		const subscribe = new Subscribe(id, broadcast, track, update.priority)
		subscribe.order = update.order
		subscribe.expires = update.expires
		subscribe.start = update.start
		subscribe.end = update.end

		return subscribe
	}
}

export class Datagrams extends Subscribe {
	static StreamID = 0x3
}

export class Info {
	priority: number
	order = Order.Descending
	expires = 0
	latest?: number

	constructor(priority: number) {
		this.priority = priority
	}

	async encode(w: Writer) {
		await w.u53(this.priority)
		await w.u53(this.order)
		await w.u53(this.expires)
		await w.u53(this.latest ? this.latest + 1 : 0)
	}

	static async decode(r: Reader): Promise<Info> {
		const priority = await r.u53()
		const order = await r.u53()
		const latest = await r.u53()

		const info = new Info(priority)
		info.latest = latest == 0 ? undefined : latest - 1
		info.order = order

		return info
	}
}

export class InfoRequest {
	broadcast: string
	track: string

	static StreamID = 0x5

	constructor(broadcast: string, track: string) {
		this.broadcast = broadcast
		this.track = track
	}

	async encode(w: Writer) {
		await w.string(this.broadcast)
		await w.string(this.track)
	}

	static async decode(r: Reader): Promise<InfoRequest> {
		return new InfoRequest(await r.string(), await r.string())
	}
}

export class FetchUpdate {
	priority: number

	constructor(priority: number) {
		this.priority = priority
	}

	async encode(w: Writer) {
		await w.u53(this.priority)
	}

	static async decode(r: Reader): Promise<FetchUpdate> {
		return new FetchUpdate(await r.u53())
	}

	static async decode_maybe(r: Reader): Promise<FetchUpdate | undefined> {
		if (await r.done()) return
		return await FetchUpdate.decode(r)
	}
}

export class Fetch extends FetchUpdate {
	broadcast: string
	track: string

	static StreamID = 0x4

	constructor(broadcast: string, track: string, priority: number) {
		super(priority)
		this.broadcast = broadcast
		this.track = track
	}

	async encode(w: Writer) {
		await w.string(this.broadcast)
		await w.string(this.track)
		await super.encode(w)
	}

	static async decode(r: Reader): Promise<Fetch> {
		const broadcast = await r.string()
		const track = await r.string()
		const update = await super.decode(r)

		const fetch = new Fetch(broadcast, track, update.priority)
		return fetch
	}
}

export class Group {
	subscribe: bigint
	sequence: number

	static StreamID = 0x0

	constructor(subscribe: bigint, sequence: number) {
		this.subscribe = subscribe
		this.sequence = sequence
	}

	async encode(w: Writer) {
		await w.u62(this.subscribe)
		await w.u53(this.sequence)
	}

	static async decode(r: Reader): Promise<Group> {
		return new Group(await r.u62(), await r.u53())
	}
}

export class GroupDrop {
	sequence: number
	count: number
	error: number

	constructor(sequence: number, count: number, error: number) {
		this.sequence = sequence
		this.count = count
		this.error = error
	}

	async encode(w: Writer) {
		await w.u53(this.sequence)
		await w.u53(this.count)
		await w.u53(this.error)
	}

	static async decode(r: Reader): Promise<GroupDrop> {
		return new GroupDrop(await r.u53(), await r.u53(), await r.u53())
	}
}

export class Frame {
	payload: Uint8Array

	constructor(payload: Uint8Array) {
		this.payload = payload
	}

	async encode(w: Writer) {
		await w.u53(this.payload.byteLength)
		await w.write(this.payload)
	}

	static async decode(r: Reader): Promise<Frame> {
		const size = await r.u53()
		const payload = await r.read(size)
		return new Frame(payload)
	}
}

function decodeRole(raw: Uint8Array | undefined): Role {
	if (!raw) throw new Error("missing role parameter")
	if (raw.length != 1) throw new Error("multi-byte varint not supported")

	switch (raw[0]) {
		case 1:
			return "publisher"
		case 2:
			return "subscriber"
		case 3:
			return "both"
		default:
			throw new Error(`invalid role: ${raw[0]}`)
	}
}

export type Bi = SessionClient | Announce | Subscribe | Datagrams | Fetch | InfoRequest
export type Uni = Group

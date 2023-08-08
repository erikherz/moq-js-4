// Rename some stuff so it's on brand.
export { createFile as New, DataStream as Stream, ISOFile, BoxParser, Log } from "mp4box"

export type {
	MP4File as File,
	MP4ArrayBuffer as ArrayBuffer,
	MP4Info as Info,
	MP4Track as Track,
	MP4AudioTrack as AudioTrack,
	MP4VideoTrack as VideoTrack,
	Sample,
	TrackOptions,
	SampleOptions,
} from "mp4box"

import { MP4Track, MP4AudioTrack, MP4VideoTrack, BoxParser, DataStream } from "mp4box"

export function isAudioTrack(track: MP4Track): track is MP4AudioTrack {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	return (track as MP4AudioTrack).audio !== undefined
}

export function isVideoTrack(track: MP4Track): track is MP4VideoTrack {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	return (track as MP4VideoTrack).video !== undefined
}

// TODO contribute to mp4box
BoxParser.dOpsBox.prototype.write = function (stream: DataStream) {
	this.size = this.ChannelMappingFamily === 0 ? 11 : 13 + this.ChannelMapping!.length
	this.writeHeader(stream)

	stream.writeUint8(this.Version)
	stream.writeUint8(this.OutputChannelCount)
	stream.writeUint16(this.PreSkip)
	stream.writeUint32(this.InputSampleRate)
	stream.writeInt16(this.OutputGain)
	stream.writeUint8(this.ChannelMappingFamily)

	if (this.ChannelMappingFamily !== 0) {
		stream.writeUint8(this.StreamCount!)
		stream.writeUint8(this.CoupledCount!)
		for (const mapping of this.ChannelMapping!) {
			stream.writeUint8(mapping)
		}
	}
}

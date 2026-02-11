// WebSocket Event Types for Courtroom Client

// import { CourtroomFrame } from '@shared/types';
import { SceneTargets } from './types/scene-targets';

// Message events
export interface CreateMessageDto {
  text: string;
  poseId?: number;
  noPoseAnimation?: boolean;
  flipped?: boolean;
  speechBubble?: number;
  characterId?: number;
  popup?: MessagePopup;
  isTestimony?: boolean;
}

export interface CreatePlainMessageDto {
  text: string;
}

export interface CreateSpectatorMessageDto {
  username: string;
  text: string;
}

export enum MessagePopup {
  Testimony = '1',
  CrossExamination = '2',
  Guilty = '3',
  NotGuilty = '4',
}

export interface MessageDto {
  userId: string;
  message: {
    text: string;
    characterId?: number;
    poseId?: number;
  }; // CourtroomFrame | string;
}

export interface PlainMessageDto {
  userId: string;
  text: string;
}

export interface SpectatorMessageDto {
  username: string;
  text: string;
}

// User events
export interface ChangeUsernameDto {
  username: string;
}

export interface LastFrameDto {
  characterId?: number;
  poseId?: number;
}

export interface UserDto {
  id: string;
  username: string;
  authUsername?: string;
  avatarUrl?: string;
  lastFrame?: LastFrameDto;
}

export interface MeDto {
  user?: UserDto;
  spectator?: boolean;
  slowmodeSeconds?: number;
}

// Room events
export interface UpdateRoomDto {
  title?: string;
  enableSpectating?: boolean;
  enableTypingIndicators?: boolean;
  frameTime?: number;
  slowModeSeconds?: number;
  restrictEvidence?: boolean;
  chatbox?: string;
  aspectRatio?: string;
  permissions?: RoomPermissions;
}

export interface UpdateRoomAdminDto {
  password?: string;
  autoTransferAdmin?: boolean;
}

export interface RoomPermissions {
  evidence: Role;
  background: Role;
  audio: Role;
}

export enum Role {
  Spectator = 'spectator',
  User = 'user',
  Mod = 'mod',
  Owner = 'owner',
}

export enum AuthType {
  Anonymous = 'anonymous',
  Discord = 'discord',
}

export interface RoomDto {
  id: string;
  title: string;
  enableSpectating: boolean;
  enableTypingIndicators: boolean;
  frameTime: number;
  authType: AuthType;
  users: UserDto[];
  mods: string[];
  ownerId: string;
  spectators: SpectatorDto[];
  slowModeSeconds: number;
  restrictEvidence: boolean;
  chatbox: string;
  aspectRatio: string;
  permissions: RoomPermissions;
  pairs: PairDto[];
  courtRecord: CourtroomEvidenceRecord;
  backgrounds: BackgroundDto[];
}

export interface SpectatorDto {
  id: string;
}

// Pair events
export interface CreatePairDto {
  invitedUserIds: string[];
}

export interface UpdatePairDto {
  backgroundUserId?: string;
  backgroundFlipped?: boolean;
}

export interface UpdatePairedUserDto {
  offsetX?: number;
  offsetY?: number;
  front?: number;
  size?: number;
  flipped?: boolean;
}

export interface UpdatePairedUserPartialDto {
  pairId: string;
  userId: string;
  offsetX?: number;
  offsetY?: number;
  front?: number;
  size?: number;
  flipped?: boolean;
}

export interface LeavePairDto {
  pairId: string;
  userId: string;
}

export interface CreateRespondPairDto {
  pairId: string;
  status: PairStatus;
}

export interface RespondPairDto extends CreateRespondPairDto {
  userId: string;
}

export interface PairDto {
  id: string;
  pairs: PairedUserDto[];
  backgroundUserId: string;
  backgroundFlipped?: boolean;
}

export interface PairedUserDto {
  userId: string;
  status: PairStatus;
  offsetX: number;
  offsetY: number;
  front: number;
  size?: number;
  flipped: boolean;
  target: SceneTargets;
}

export enum PairStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
}

// Admin events
export interface UpdateModsDto {
  mods: string[];
}

export interface CreateBanDto {
  userId: string;
}

export interface BanDto {
  id: string;
  username: string;
  authUsername?: string;
}

export interface RoomModDto {
  bans: BanDto[];
}

export interface RoomAdminDto extends RoomModDto {
  password: string;
  autoTransferAdmin: boolean;
}

// Evidence events
export interface CreateEvidenceDto {
  evidenceId: number;
  name: string;
  description?: string;
  iconUrl: string;
  url?: string;
  type: 'image' | 'video';
}

export interface CreateProfileDto {
  evidenceId: number;
  name: string;
  description?: string;
  iconUrl: string;
}

export interface EvidenceDto {
  username: string;
  userId: string;
  id: string;
  evidenceId: number;
  name: string;
  description: string;
  iconUrl: string;
  url?: string;
  type: 'image' | 'video' | 'embed';
}

export interface ProfileDto {
  username: string;
  userId: string;
  id: string;
  evidenceId: number;
  name: string;
  description: string;
  iconUrl: string;
}

export interface CourtroomEvidenceRecord {
  evidence: EvidenceDto[];
  profiles: ProfileDto[];
}

// Background events
export interface CreateBackgroundDto {
  backgroundId: number;
  url: string;
  deskUrl?: string;
  side: BackgroundSide;
}

export interface BackgroundDto {
  username: string;
  userId: string;
  id: string;
  backgroundId: number;
  url: string;
  deskUrl?: string;
  side: BackgroundSide;
}

export enum BackgroundSide {
  Any = 'any',
  Defense = 'defense',
  Prosecution = 'prosecution',
  Witness = 'witness',
  Judge = 'judge',
  Counsel = 'counsel',
}

// Error events
export interface CriticalErrorDto {
  title?: string;
  message?: string;
  titleCode?: string;
  messageCode?: string;
}

// Client-to-Server Events
export interface ClientToServerEvents {
  // Message events
  message: (data: CreateMessageDto) => void;
  plain_message: (data: CreatePlainMessageDto) => void;
  spectator_message: (data: CreateSpectatorMessageDto) => void;
  typing: () => void;

  // User events
  me: () => void;
  change_username: (data: ChangeUsernameDto) => void;

  // Room events
  get_room: () => void;
  update_room: (data: UpdateRoomDto) => void;
  update_room_admin: (data: UpdateRoomAdminDto) => void;

  // Pair events
  create_pair: (data: CreatePairDto) => void;
  update_pair: (data: UpdatePairDto) => void;
  update_paired_user: (data: UpdatePairedUserDto) => void;
  respond_to_pair: (data: CreateRespondPairDto) => void;
  remove_pair: () => void;
  leave_pair: () => void;

  // Admin events
  update_mods: (data: UpdateModsDto) => void;
  kick: (data: CreateBanDto) => void;
  create_ban: (data: CreateBanDto) => void;
  remove_ban: (banId: string) => void;
  owner_transfer: (userId: string) => void;

  // Evidence events
  add_evidence: (data: CreateEvidenceDto) => void;
  add_profile: (data: CreateProfileDto) => void;
  delete_evidence: (id: string) => void;
  delete_profile: (id: string) => void;

  // Background events
  add_background: (data: CreateBackgroundDto) => void;
  delete_background: (id: string) => void;
}

// Server-to-Client Events
export interface ServerToClientEvents {
  // Room events
  update_room: (data: RoomDto) => void;
  update_room_admin: (data: RoomAdminDto) => void;
  update_room_mod: (data: RoomModDto) => void;

  // Message events
  message: (data: MessageDto) => void;
  plain_message: (data: PlainMessageDto) => void;
  spectator_message: (data: SpectatorMessageDto) => void;
  typing: (data: string) => void;

  // User events
  me: (data: MeDto) => void;
  user_joined: (data: UserDto) => void;
  user_left: (userId: string) => void;
  spectator_joined: (spectatorId: string) => void;
  spectator_left: (spectatorId: string) => void;
  update_user: (userId: string, data: { username: string }) => void;
  owner_transfer: (newOwnerId: string) => void;

  // Pair events
  create_pair: (data: PairDto) => void;
  update_pair: (data: UpdatePairDto & { pairId: string }) => void;
  pair_response: (data: RespondPairDto) => void;
  update_paired_user: (data: UpdatePairedUserPartialDto) => void;
  leave_pair: (data: LeavePairDto) => void;
  remove_pair: (pairId: string) => void;

  // Admin events
  update_mods: (mods: string[]) => void;

  // Evidence events
  add_evidence: (data: EvidenceDto) => void;
  add_profile: (data: ProfileDto) => void;
  delete_evidence: (id: string) => void;
  delete_profile: (id: string) => void;

  // Background events
  add_background: (data: BackgroundDto) => void;
  delete_background: (id: string) => void;

  // Error events
  error: (message: string) => void;
  critical_error: (data: CriticalErrorDto) => void;
}

// Connection query parameters
export interface ConnectionQuery {
  roomId: string;
  username?: string;
  password?: string;
}

// Socket connection options
export interface CourtroomSocketOptions {
  query: ConnectionQuery;
  auth?: {
    token?: string;
  };
  autoConnect?: boolean;
  transports?: string[];
  timeout?: number;
  forceNew?: boolean;
}
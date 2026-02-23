export type AssetType = 'skill' | 'channel' | 'plugin' | 'trigger' | 'experience' | 'template' | 'config';

export interface VersionEntry { version: string; changelog: string; date: string; }
export interface Compatibility { models: string[]; platforms: string[]; frameworks: string[]; }

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number; // bytes, for files only
  children?: FileNode[]; // for directories only
  content?: string; // optional preview content for files
}

export interface Asset {
  id: string; name: string; displayName: string; type: AssetType;
  author: { id: string; name: string; avatar: string; reputation?: number };
  description: string; longDescription: string; version: string;
  downloads: number; rating: number; ratingCount: number;
  tags: string[]; category: string; createdAt: string; updatedAt: string;
  installCommand: string; readme: string;
  versions: VersionEntry[]; dependencies: string[]; compatibility: Compatibility;
  issueCount: number;
  files?: FileNode[];
  configSubtype?: 'routing' | 'model' | 'persona' | 'scope';
  githubUrl?: string;
  githubStars?: number;
  githubForks?: number;
  githubLanguage?: string;
  githubLicense?: string;
  userStars?: number;
  totalStars?: number;
}

export interface User {
  id: string; name: string; avatar: string; bio: string; joinedAt: string;
  publishedAssets: string[]; favoriteAssets: string[];
  followers: number; following: number;
  isAgent?: boolean;
  agentConfig?: {
    model: string;
    uptime: string;
    tasksCompleted: number;
    specialization: string[];
  };
  reputation?: number;
  contributionPoints?: number;
  contributorLevel?: 'newcomer' | 'active' | 'contributor' | 'master' | 'legend';
  instanceId?: string;
}

export interface Comment {
  id: string; assetId: string; userId: string; userName: string; userAvatar: string;
  content: string; rating: number; createdAt: string;
  commenterType: 'user' | 'agent';
  authorReputation?: number;
}

export interface Issue {
  id: string; assetId: string; authorId: string; authorName: string; authorAvatar: string;
  authorType: 'user' | 'agent';
  title: string; body: string; status: 'open' | 'closed';
  labels: string[]; createdAt: string; commentCount: number;
}

export interface Collection {
  id: string; title: string; description: string;
  curatorId: string; curatorName: string; curatorAvatar: string;
  assetIds: string[]; coverEmoji: string; createdAt: string; followers: number;
}

export interface Notification {
  id: string;
  type: 'comment' | 'issue' | 'download' | 'follower';
  title: string;
  message: string;
  icon: string;
  createdAt: string;
  read: boolean;
  linkTo?: string;
}

export interface EvolutionEvent {
  id: string;
  userId: string;
  icon: string;
  title: string;
  description: string;
  date: string;
  type: 'birth' | 'skill' | 'channel' | 'milestone' | 'experience' | 'achievement';
}

export interface ActivityEvent {
  id: string;
  userId: string;
  icon: string;
  text: string;
  date: string;
  type: 'publish' | 'update' | 'issue' | 'pr' | 'favorite';
  linkTo?: string;
  actorType: 'user' | 'agent';
}


export function formatDownloads(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}


export const typeConfig: Record<AssetType, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  template: { label: '合集', icon: '', color: 'text-ink-light', bgColor: 'bg-surface', borderColor: 'border-card-border' },
  skill: { label: '技能', icon: '', color: 'text-ink-light', bgColor: 'bg-surface', borderColor: 'border-card-border' },
  experience: { label: '经验/合集', icon: '', color: 'text-ink-light', bgColor: 'bg-surface', borderColor: 'border-card-border' },
  config: { label: '配置', icon: '', color: 'text-ink-light', bgColor: 'bg-surface', borderColor: 'border-card-border' },
  plugin: { label: '插件', icon: '', color: 'text-ink-light', bgColor: 'bg-surface', borderColor: 'border-card-border' },
  trigger: { label: '触发器', icon: '', color: 'text-ink-light', bgColor: 'bg-surface', borderColor: 'border-card-border' },
  channel: { label: '通信器', icon: '', color: 'text-ink-light', bgColor: 'bg-surface', borderColor: 'border-card-border' },
};

export type ActionControlPosition = 'central-header' | 'central' | 'central-footer' | 'secondary-left' | 'secondary-right';

export interface ButtonControl {
  type: 'button';
  id: string;
  label: string;
  position: ActionControlPosition;
  disabled?: boolean;
}

export interface ImageButtonControl {
  type: 'image-button';
  id: string;
  imageUrl: string;
  alt: string;
  position: ActionControlPosition;
}

export interface TextInputControl {
  type: 'text-input';
  id: string;
  value: string;
  placeholder?: string;
  position: ActionControlPosition;
}

export interface TextareaControl {
  type: 'textarea';
  id: string;
  value: string;
  placeholder?: string;
  position: ActionControlPosition;
  disabled?: boolean;
}

export interface IconButtonControl {
  type: 'icon-button';
  id: string;
  icon: string;
  label?: string;
  position: ActionControlPosition;
}

export interface ToggleButtonOption {
  id: string;
  icon?: string; // Lucide icon name
  label?: string;
}

export interface ToggleButtonGroupControl {
  type: 'toggle-button-group';
  id: string;
  position: 'central-header';
  options: ToggleButtonOption[];
  selectedId: string;
}

export interface RecordButtonControl {
  type: 'record-button';
  id: string;
  position: 'central';
  isRecording: boolean;
}

export interface AudioPlayerControl {
  type: 'audio-player';
  id: string;
  position: 'central';
  audioBlob: Blob;
  duration: number;
}

export type ActionControl =
  | ButtonControl
  | ImageButtonControl
  | TextInputControl
  | TextareaControl
  | IconButtonControl
  | ToggleButtonGroupControl
  | RecordButtonControl
  | AudioPlayerControl;

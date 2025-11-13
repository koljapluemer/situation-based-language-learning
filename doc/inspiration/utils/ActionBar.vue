<template>
  <div class="relative">
    <!-- Central Header - toggle buttons above central element -->
    <div v-if="centralHeaderControls.length > 0" class="flex justify-center px-4 pb-2 relative z-10">
      <template v-for="control in centralHeaderControls" :key="control.id">
        <div v-if="control.type === 'toggle-button-group'" class="join">
          <button
            v-for="option in control.options"
            :key="option.id"
            @click="emit('action', control.id, option.id)"
            :class="[
              'join-item',
              'btn',
              'btn-sm',
              'border-3',
              'border-secondary',
              option.id === control.selectedId ? 'btn-primary' : 'btn-ghost'
            ]"
          >
            <component v-if="option.icon" :is="getIcon(option.icon)" :size="20" />
            <span v-if="option.label">{{ option.label }}</span>
          </button>
        </div>
      </template>
    </div>

    <!-- Central controls - positioned at top, naturally sized -->
    <div class="flex flex-col md:flex-row justify-center gap-2 px-4 relative z-10">
      <template v-for="control in centralControls" :key="control.id">
        <button
          v-if="control.type === 'button'"
          @click="emit('action', control.id)"
          :class="getButtonClass(control.position)"
          :disabled="control.disabled"
        >
          {{ control.label }}
        </button>
        <button
          v-else-if="control.type === 'image-button'"
          @click="emit('action', control.id)"
          :class="getImageButtonClass(control.position)"
        >
          <img :src="control.imageUrl" :alt="control.alt" class="w-full h-full object-cover" />
        </button>
        <input
          v-else-if="control.type === 'text-input'"
          type="text"
          :value="control.value"
          @input="emit('action', control.id, ($event.target as HTMLInputElement).value)"
          :placeholder="control.placeholder"
          class="input input-lg w-full max-w-96 border-3 border-secondary bg-base-100 text-base-content placeholder-base-content/40 focus:bg-base-100 focus:border-primary focus:outline-none"
        />
        <textarea
          v-else-if="control.type === 'textarea'"
          :value="control.value"
          @input="emit('action', control.id, ($event.target as HTMLTextAreaElement).value)"
          :placeholder="control.placeholder"
          :disabled="control.disabled"
          class="textarea w-full max-w-96 h-40 text-xl border-3 border-secondary bg-base-100 text-base-content placeholder-base-content/40 resize-none focus:bg-base-100 focus:border-primary focus:outline-none"
        />
        <button
          v-else-if="control.type === 'icon-button'"
          @click="emit('action', control.id)"
          :class="getButtonClass(control.position)"
        >
          <component :is="getIcon(control.icon)" />
          <span v-if="control.label">{{ control.label }}</span>
        </button>
        <button
          v-else-if="control.type === 'record-button'"
          @click="emit('action', control.id)"
          :class="[
            'btn',
            'btn-circle',
            'btn-xl',
            'border-3',
            'border-secondary',
            control.isRecording ? 'btn-error' : 'btn-primary'
          ]"
        >
          <component :is="control.isRecording ? getIcon('stop') : getIcon('microphone')" :size="48" />
        </button>
        <div v-else-if="control.type === 'audio-player'" class="flex flex-col items-center gap-2">
          <button
            @click="playAudio(control)"
            :class="[
              'btn',
              'btn-circle',
              'btn-xl',
              'border-3',
              'border-secondary',
              'btn-primary'
            ]"
            :disabled="isPlayingAudio"
          >
            <component v-if="!isPlayingAudio" :is="getIcon('play')" :size="48" />
            <span v-else class="loading loading-spinner loading-lg"></span>
          </button>
        </div>
      </template>
    </div>

    <!-- Central Footer - buttons below central element -->
    <!-- Always reserve space to prevent layout jump -->
    <div class="flex justify-center gap-2 px-4 pt-2 relative z-10 min-h-[48px]">
      <template v-for="control in centralFooterControls" :key="control.id">
        <button
          v-if="control.type === 'button'"
          @click="emit('action', control.id)"
          :class="getButtonClass(control.position)"
          :disabled="control.disabled"
        >
          {{ control.label }}
        </button>
        <button
          v-else-if="control.type === 'icon-button'"
          @click="emit('action', control.id)"
          :class="getButtonClass(control.position)"
        >
          <component :is="getIcon(control.icon)" />
          <span v-if="control.label">{{ control.label }}</span>
        </button>
      </template>
    </div>

    <!-- Colored background section - negative margin to overlap central buttons -->
    <div class="-mt-[30px] bg-primary border-t-10 border-t-secondary p-4 pt-[40px] text-white">
      <div class="flex justify-between items-end gap-4">
        <!-- Left controls -->
        <div class="flex flex-row gap-2 items-center">
          <!-- Default skip button -->
          <button
            v-if="!hideSkipButton"
            @click="emit('action', 'skip')"
            class="btn btn-sm btn-ghost text-white"
          >
            <component :is="getIcon('skip')" :size="20" />
          </button>

          <!-- Default disable button -->
          <button
            v-if="!hideDisableButton"
            @click="emit('action', 'disable')"
            class="btn btn-sm btn-ghost text-white"
          >
            <component :is="getIcon('disable')" :size="20" />
          </button>

          <!-- Default jump-to button -->
          <button
            v-if="!hideJumpToButton"
            @click="emit('action', 'jump-to')"
            class="btn btn-sm btn-ghost text-white"
          >
            <component :is="getIcon('jump-to')" :size="20" />
          </button>

          <!-- Additional left controls -->
          <template v-for="control in secondaryLeftControls" :key="control.id">
            <button
              v-if="control.type === 'button'"
              @click="emit('action', control.id)"
              :class="getButtonClass(control.position)"
            >
              {{ control.label }}
            </button>
            <button
              v-else-if="control.type === 'icon-button'"
              @click="emit('action', control.id)"
              :class="getButtonClass(control.position)"
            >
              <component :is="getIcon(control.icon)" />
              <span v-if="control.label">{{ control.label }}</span>
            </button>
          </template>
        </div>

        <!-- Right controls -->
        <div class="flex flex-row gap-2 items-center">
          <template v-for="control in secondaryRightControls" :key="control.id">
            <button
              v-if="control.type === 'button'"
              @click="emit('action', control.id)"
              :class="getButtonClass(control.position)"
            >
              {{ control.label }}
            </button>
            <button
              v-else-if="control.type === 'icon-button'"
              @click="emit('action', control.id)"
              :class="getButtonClass(control.position)"
            >
              <component :is="getIcon(control.icon)" />
              <span v-if="control.label">{{ control.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import type { ActionControl, ActionControlPosition, AudioPlayerControl } from './ActionControl';
import { Volume2, Play, SkipForward, Ban, ExternalLink, Mic, Square, Pencil } from 'lucide-vue-next';

const props = defineProps<{
  controls: ActionControl[];
  hideSkipButton?: boolean;
  hideDisableButton?: boolean;
  hideJumpToButton?: boolean;
}>();

const emit = defineEmits<{
  action: [controlId: string, data?: string];
}>();

const centralHeaderControls = computed(() =>
  props.controls.filter((c) => c.position === 'central-header')
);

const secondaryLeftControls = computed(() =>
  props.controls.filter((c) => c.position === 'secondary-left')
);

const centralControls = computed(() =>
  props.controls.filter((c) => c.position === 'central')
);

const centralFooterControls = computed(() =>
  props.controls.filter((c) => c.position === 'central-footer')
);

const secondaryRightControls = computed(() =>
  props.controls.filter((c) => c.position === 'secondary-right')
);

// Audio playback state
const isPlayingAudio = ref(false);
const audioElement = ref<HTMLAudioElement>();
const audioUrl = ref<string | null>(null);

const playAudio = async (control: AudioPlayerControl) => {
  if (isPlayingAudio.value) return;

  // Clean up any existing audio URL
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
  }

  // Create new audio URL from blob
  audioUrl.value = URL.createObjectURL(control.audioBlob);

  // Create audio element if not exists
  if (!audioElement.value) {
    audioElement.value = new Audio();
    audioElement.value.addEventListener('ended', () => {
      isPlayingAudio.value = false;
    });
  }

  audioElement.value.src = audioUrl.value;
  isPlayingAudio.value = true;

  try {
    await audioElement.value.play();
  } catch {
    // Audio play failed
    isPlayingAudio.value = false;
  }
};

// Cleanup on unmount
onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
  }
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value.src = '';
  }
});

function getButtonClass(position: ActionControlPosition): string {
  const classes = ['btn', 'border-3', 'border-secondary'];

  // Position determines size
  if (position === 'central') {
    classes.push('btn-xl', 'text-xl', 'px-8', 'py-4');
  }
  // secondary-left and secondary-right use default size

  classes.push('btn-primary');

  return classes.join(' ');
}

function getImageButtonClass(position: ActionControlPosition): string {
  const classes = ['btn', 'p-1'];

  // Position determines size
  if (position === 'central') {
    classes.push('w-32', 'h-32');
  } else {
    classes.push('w-24', 'h-24');
  }

  return classes.join(' ');
}

function getIcon(icon: string) {
  const iconMap: Record<string, unknown> = {
    volume: Volume2,
    play: Play,
    skip: SkipForward,
    disable: Ban,
    'jump-to': ExternalLink,
    microphone: Mic,
    stop: Square,
    pencil: Pencil,
  };
  return iconMap[icon] || Play;
}
</script>
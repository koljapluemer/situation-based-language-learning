<template>
  <div class="relative">
    <!-- Central controls - positioned at top, naturally sized -->
    <div class="flex flex-col md:flex-row justify-center gap-2 px-4 relative z-10">
      <template v-for="control in centralControls" :key="control.id">
        <button
          v-if="control.type === 'button'"
          @click="emit('action', control.id)"
          :class="getButtonClass('central')"
          :disabled="control.disabled"
        >
          {{ control.label }}
        </button>
      </template>
    </div>

    <!-- Central Footer - buttons below central element -->
    <div class="flex justify-center gap-2 px-4 pt-2 relative z-10 min-h-[48px]">
      <template v-for="control in centralFooterControls" :key="control.id">
        <button
          v-if="control.type === 'button'"
          @click="emit('action', control.id)"
          :class="getButtonClass('central-footer')"
          :disabled="control.disabled"
        >
          {{ control.label }}
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
            <SkipForward :size="20" />
          </button>

          <!-- Additional left controls -->
          <template v-for="control in secondaryLeftControls" :key="control.id">
            <button
              v-if="control.type === 'button'"
              @click="emit('action', control.id)"
              class="btn btn-sm btn-ghost text-white"
            >
              {{ control.label }}
            </button>
          </template>
        </div>

        <!-- Right controls -->
        <div class="flex flex-row gap-2 items-center">
          <template v-for="control in secondaryRightControls" :key="control.id">
            <button
              v-if="control.type === 'button'"
              @click="emit('action', control.id)"
              class="btn btn-sm btn-ghost text-white"
            >
              {{ control.label }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SkipForward } from 'lucide-vue-next';

export interface ActionControl {
  id: string;
  type: 'button';
  label: string;
  position: 'central' | 'central-footer' | 'secondary-left' | 'secondary-right';
  disabled?: boolean;
}

const props = defineProps<{
  controls: ActionControl[];
  hideSkipButton?: boolean;
}>();

const emit = defineEmits<{
  action: [controlId: string];
}>();

const centralControls = computed(() =>
  props.controls.filter((c) => c.position === 'central')
);

const centralFooterControls = computed(() =>
  props.controls.filter((c) => c.position === 'central-footer')
);

const secondaryLeftControls = computed(() =>
  props.controls.filter((c) => c.position === 'secondary-left')
);

const secondaryRightControls = computed(() =>
  props.controls.filter((c) => c.position === 'secondary-right')
);

function getButtonClass(position: string): string {
  const classes = ['btn', 'border-3', 'border-secondary'];

  // Position determines size
  if (position === 'central') {
    classes.push('btn-xl', 'text-xl', 'px-8', 'py-4');
  } else if (position === 'central-footer') {
    classes.push('btn-md');
  }

  classes.push('btn-primary');

  return classes.join(' ');
}
</script>

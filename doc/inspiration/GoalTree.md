```vue

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1>{{ situation?.description || 'Loading...' }}</h1>
      <router-link to="/situations" class="btn btn-outline">Back to List</router-link>
    </div>

    <div v-if="loading" class="text-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
      <p class="mt-4">Loading...</p>
    </div>

    <div v-else-if="error" class="alert alert-error mb-6">
      <span>{{ error }}</span>
    </div>

    <div v-else-if="situation">
      <h2 class="text-xl font-bold mt-6 mb-4">Goals</h2>

      <div class="flex gap-2 mb-4">
        <button @click="showSelectModal = true" class="btn btn-outline">Add Existing Goal</button>
        <button @click="showCreateModal = true" class="btn btn-primary">Create New Goal</button>
      </div>

      <!-- Goals Tree -->
      <div v-if="goalsList.length === 0" class="text-center py-8">
        <p class="text-light">No goals attached to this situation yet</p>
      </div>

      <div v-else class="space-y-1">
        <GoalTreeItem
          v-for="goal in goalsList"
          :key="goal.id"
          :goal="goal"
          :situation-id="situationId"
          :initial-open-states="getTreeState(situationId, goal.id) || getDefaultTreeState()"
          @remove="removeGoal(goal.id)"
          @translation-selected="handleTranslationSelected"
          @translation-added="handleTranslationAdded"
          @translation-disconnected="handleTranslationDisconnected"
        />
      </div>

      <!-- Resources Tree -->
      <h2 class="text-xl font-bold mt-8 mb-4">Resources</h2>
      <div class="flex gap-2 mb-4">
        <button @click="showSelectResourceModal = true" class="btn btn-outline">Add Existing Resource</button>
        <button @click="showCreateResourceModal = true" class="btn btn-primary">Create New Resource</button>
      </div>

      <div v-if="resourcesList.length === 0" class="text-center py-8">
        <p class="text-light">No resources attached to this situation yet</p>
      </div>

      <div v-else class="space-y-1">
        <ResourceTreeItem
          v-for="resource in resourcesList"
          :key="resource.id"
          :resource="resource"
          :situation-id="situationId"
          :initial-open-states="getResourceTreeState(situationId, resource.id) || getDefaultResourceTreeState()"
          @remove="removeResource(resource.id)"
          @vocab-added="handleResourceVocabAdded"
          @vocab-disconnected="handleResourceVocabDisconnected"
        />
      </div>
    </div>

    <SelectGoalModal
      :show="showSelectModal"
      :exclude-goal-ids="situation?.goals || []"
      @close="showSelectModal = false"
      @goal-selected="handleGoalSelected"
    />

    <AddGoalModal
      :show="showCreateModal"
      @close="showCreateModal = false"
      @goal-added="handleGoalAdded"
    />

    <SelectResourceModal
      :show="showSelectResourceModal"
      :exclude-resource-ids="situation?.immersionResources || []"
      @close="showSelectResourceModal = false"
      @resource-selected="handleResourceSelected"
    />

    <AddResourceModal
      :show="showCreateResourceModal"
      @close="showCreateResourceModal = false"
      @resource-added="handleResourceAdded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, toRaw } from 'vue';
import { useRoute } from 'vue-router';
import type { SituationRepoContract } from '@frontend-shared/entities/situationss/SituationRepoContract';
import type { GoalRepoContract } from '@frontend-shared/entities/goals/GoalRepoContract';
import type { ResourceRepoContract } from '@frontend-shared/entities/resources/ResourceRepoContract';
import type { Situation } from '@frontend-shared/entities/situationss/Situation';
import type { GoalData } from '@frontend-shared/entities/goals/Goal';
import type { Resource } from '@frontend-shared/entities/resources/Resource';
import { useToast } from '@frontend-shared/shared/toasts';
import SelectGoalModal from '@frontend-shared/features/goal-select/SelectGoalModal.vue';
import AddGoalModal from '@frontend-shared/features/goal-add/AddGoalModal.vue';
import SelectResourceModal from '@frontend-shared/features/resource-select/SelectResourceModal.vue';
import AddResourceModal from '@frontend-shared/features/resource-add/AddResourceModal.vue';
import GoalTreeItem from '@frontend-shared/features/goal-tree/GoalTreeItem.vue';
import ResourceTreeItem from '@frontend-shared/features/resource-tree/ResourceTreeItem.vue';
import { getTreeState, getDefaultTreeState, getResourceTreeState, getDefaultResourceTreeState } from '@frontend-shared/features/goal-tree/treeState';

const route = useRoute();
const situationRepo = inject<SituationRepoContract>('situationRepo')!;
const goalRepo = inject<GoalRepoContract>('goalRepo')!;
const resourceRepo = inject<ResourceRepoContract>('resourceRepo')!;
const toast = useToast();

const situationId = route.params.id as string;
const situation = ref<Situation | null>(null);
const goalsList = ref<GoalData[]>([]);
const resourcesList = ref<Resource[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showSelectModal = ref(false);
const showCreateModal = ref(false);
const showSelectResourceModal = ref(false);
const showCreateResourceModal = ref(false);

async function loadSituation() {
  loading.value = true;
  error.value = null;

  try {
    const situationId = route.params.id as string;
    const loadedSituation = await situationRepo.getSituationsByIds([situationId]);

    if (loadedSituation.length === 0) {
      error.value = 'Situation not found';
      return;
    }

    situation.value = loadedSituation[0];
    await Promise.all([loadGoals(), loadResources()]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load situation';
  } finally {
    loading.value = false;
  }
}

async function loadGoals() {
  if (!situation.value) return;

  try {
    const goalsPromises = situation.value.goals.map(id => goalRepo.getById(id));
    const goalsResults = await Promise.all(goalsPromises);
    goalsList.value = goalsResults.filter((g): g is GoalData => g !== undefined);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to load goals: ${errorMessage}`);
  }
}

async function loadResources() {
  if (!situation.value) return;

  try {
    const resourcesPromises = situation.value.immersionResources.map(id => resourceRepo.getResourceById(id));
    const resourcesResults = await Promise.all(resourcesPromises);
    resourcesList.value = resourcesResults.filter((r): r is Resource => r !== undefined);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to load resources: ${errorMessage}`);
  }
}

async function handleGoalSelected(goalId: string) {
  if (!situation.value) return;

  try {
    const updatedSituation = {
      id: situation.value.id,
      description: situation.value.description,
      goals: [...toRaw(situation.value.goals), goalId],
      immersionResources: [...toRaw(situation.value.immersionResources)],
      relevantForLanguages: [...toRaw(situation.value.relevantForLanguages)]
    };

    await situationRepo.updateSituation(updatedSituation);
    situation.value = updatedSituation;
    await loadGoals();
    toast.success('Goal added to situation');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to add goal: ${errorMessage}`);
  }
}

async function handleGoalAdded(goalId: string) {
  await handleGoalSelected(goalId);
}

// Translation handlers for goals
async function handleTranslationSelected(goalId: string, translationId: string) {
  await updateGoalArray(goalId, 'translations', translationId, 'add');
}

async function handleTranslationAdded(goalId: string, translationId: string) {
  await updateGoalArray(goalId, 'translations', translationId, 'add');
}

async function handleTranslationDisconnected(goalId: string, translationId: string) {
  await updateGoalArray(goalId, 'translations', translationId, 'remove');
}

// Generic update function for goals
async function updateGoalArray(
  goalId: string,
  arrayName: 'translations',
  itemId: string,
  action: 'add' | 'remove'
) {
  const goal = goalsList.value.find(g => g.id === goalId);
  if (!goal) return;

  try {
    const currentArray = toRaw(goal[arrayName]);
    const updatedArray = action === 'add'
      ? [...currentArray, itemId]
      : currentArray.filter(id => id !== itemId);

    const updates = {
      language: goal.language,
      title: goal.title,
      translations: updatedArray,
      notes: [...toRaw(goal.notes)],
      factCards: [...toRaw(goal.factCards)],
      origins: [...toRaw(goal.origins)],
      isAchieved: goal.isAchieved
    };

    await goalRepo.update(goal.id, updates);
    await loadGoals();

    const actionText = action === 'add' ? 'added to' : 'removed from';
    toast.success(`Translation ${actionText} goal`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to update goal: ${errorMessage}`);
  }
}

async function removeGoal(goalId: string) {
  if (!situation.value) return;
  if (!confirm('Remove this goal from the situation?')) return;

  try {
    const updatedSituation = {
      id: situation.value.id,
      description: situation.value.description,
      goals: toRaw(situation.value.goals).filter(id => id !== goalId),
      immersionResources: [...toRaw(situation.value.immersionResources)],
      relevantForLanguages: [...toRaw(situation.value.relevantForLanguages)]
    };

    await situationRepo.updateSituation(updatedSituation);
    situation.value = updatedSituation;
    await loadGoals();
    toast.success('Goal removed from situation');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to remove goal: ${errorMessage}`);
  }
}

// Resource handlers
async function handleResourceSelected(resourceId: string) {
  if (!situation.value) return;

  try {
    const updatedSituation = {
      id: situation.value.id,
      description: situation.value.description,
      goals: [...toRaw(situation.value.goals)],
      immersionResources: [...toRaw(situation.value.immersionResources), resourceId],
      relevantForLanguages: [...toRaw(situation.value.relevantForLanguages)]
    };

    await situationRepo.updateSituation(updatedSituation);
    situation.value = updatedSituation;
    await loadResources();
    toast.success('Resource added to situation');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to add resource: ${errorMessage}`);
  }
}

async function handleResourceAdded(resourceId: string) {
  await handleResourceSelected(resourceId);
}

async function handleResourceVocabAdded(resourceId: string, vocabId: string) {
  const resource = resourcesList.value.find(r => r.id === resourceId);
  if (!resource) return;

  try {
    const updatedResource = {
      ...toRaw(resource),
      vocab: [...toRaw(resource.vocab), vocabId]
    };

    await resourceRepo.updateResource(updatedResource);
    await loadResources();
    toast.success('Vocab added to resource');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to add vocab to resource: ${errorMessage}`);
  }
}

async function handleResourceVocabDisconnected(resourceId: string, vocabId: string) {
  const resource = resourcesList.value.find(r => r.id === resourceId);
  if (!resource) return;

  try {
    const updatedResource = {
      ...toRaw(resource),
      vocab: toRaw(resource.vocab).filter(id => id !== vocabId)
    };

    await resourceRepo.updateResource(updatedResource);
    await loadResources();
    toast.success('Vocab removed from resource');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to remove vocab from resource: ${errorMessage}`);
  }
}

async function removeResource(resourceId: string) {
  if (!situation.value) return;
  if (!confirm('Remove this resource from the situation?')) return;

  try {
    const updatedSituation = {
      id: situation.value.id,
      description: situation.value.description,
      goals: [...toRaw(situation.value.goals)],
      immersionResources: toRaw(situation.value.immersionResources).filter(id => id !== resourceId),
      relevantForLanguages: [...toRaw(situation.value.relevantForLanguages)]
    };

    await situationRepo.updateSituation(updatedSituation);
    situation.value = updatedSituation;
    await loadResources();
    toast.success('Resource removed from situation');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Failed to remove resource: ${errorMessage}`);
  }
}

onMounted(async () => {
  await loadSituation();
});
</script>
```
/**
 * Field Animation Queue
 * 
 * Handles sequential field updates with visual delays so users can
 * follow along as the AI fills multiple fields.
 * 
 * When the AI fills multiple fields quickly, this queue ensures:
 * 1. Each field scrolls into view with a delay between fields
 * 2. Value appears with a brief "typing" feel
 * 3. User has minimum time to see each change
 */

// Timing constants (in milliseconds)
const DELAY_BEFORE_SCROLL = 150;      // Brief pause before scrolling to new field
const DELAY_AFTER_SCROLL = 400;        // Wait for scroll animation to complete
const DELAY_AFTER_VALUE_SET = 1500;     // Minimum display time after value appears
const DELAY_BETWEEN_FIELDS = 1000;      // Gap between processing different fields

interface QueuedFieldUpdate {
  fieldId: string;
  value: string;
  onSetValue: (fieldId: string, value: string) => void;
  onFocusField: (fieldId: string | null) => void;
  onMarkComplete: (fieldId: string) => void;
}

class FieldAnimationQueue {
  private queue: QueuedFieldUpdate[] = [];
  private isProcessing = false;
  private currentFieldId: string | null = null;

  /**
   * Add a field update to the queue
   * Returns immediately - the update will be processed asynchronously
   */
  enqueue(update: QueuedFieldUpdate) {
    this.queue.push(update);
    this.processNext();
  }

  /**
   * Process the next item in the queue
   */
  private async processNext() {
    // If already processing or queue is empty, do nothing
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const update = this.queue.shift()!;

    try {
      // If switching to a different field, add delay between fields
      if (this.currentFieldId && this.currentFieldId !== update.fieldId) {
        await this.delay(DELAY_BETWEEN_FIELDS);
      }
      this.currentFieldId = update.fieldId;

      // Step 1: Brief pause before scrolling
      await this.delay(DELAY_BEFORE_SCROLL);

      // Step 2: Focus the field (triggers scroll via useEffect in SimpleForm)
      update.onFocusField(update.fieldId);

      // Step 3: Wait for scroll animation to complete
      await this.delay(DELAY_AFTER_SCROLL);

      // Step 4: Set the value
      update.onSetValue(update.fieldId, update.value);

      // Step 5: Mark as complete
      update.onMarkComplete(update.fieldId);

      // Step 6: Wait so user can see the change
      await this.delay(DELAY_AFTER_VALUE_SET);

    } catch (error) {
      console.error('[FieldAnimationQueue] Error processing update:', error);
    }

    this.isProcessing = false;

    // Process next item if any
    if (this.queue.length > 0) {
      this.processNext();
    }
  }

  /**
   * Helper to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the queue (e.g., when user interrupts)
   */
  clear() {
    this.queue = [];
    this.currentFieldId = null;
  }

  /**
   * Get queue length (for debugging)
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is busy
   */
  get isBusy(): boolean {
    return this.isProcessing || this.queue.length > 0;
  }
}

// Singleton instance
export const fieldAnimationQueue = new FieldAnimationQueue();
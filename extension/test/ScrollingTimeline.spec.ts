import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ScrollingTimeline, { type ScrollingTimelineItem } from '@/assets/components/ScrollingTimeline.vue';

const items: ScrollingTimelineItem[] = [
  { id: 'one', date: '01.01', title: '第一阶段', description: '需求确认' },
  { id: 'two', date: '01.15', title: '第二阶段', description: '开始开发' },
  { id: 'three', date: '02.01', title: '第三阶段', description: '完成发布' },
];

describe('ScrollingTimeline.vue', () => {
  it('renders all timeline items and selects the first item by default', () => {
    const wrapper = mount(ScrollingTimeline, { props: { items } });

    expect(wrapper.findAll('.timeline-item')).toHaveLength(3);
    expect(wrapper.find('.timeline-item--active').text()).toContain('第一阶段');
    expect(wrapper.find('.timeline-count').text()).toBe('1 / 3');
  });

  it('emits the selected item and updates progress when a card is clicked', async () => {
    const wrapper = mount(ScrollingTimeline, { props: { items, modelValue: 'one' } });

    await wrapper.findAll('.timeline-card')[1].trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['two']]);
    expect(wrapper.emitted('select')?.[0]?.[0]).toEqual(items[1]);
  });

  it('moves with keyboard navigation and disables edge controls', async () => {
    const wrapper = mount(ScrollingTimeline, { props: { items, modelValue: 'two' } });
    const track = wrapper.find('.timeline-track');

    await track.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')).toEqual([['three']]);

    await wrapper.setProps({ modelValue: 'three' });
    expect(wrapper.find('.timeline-nav--next').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.timeline-nav--previous').attributes('disabled')).toBeUndefined();
  });
});

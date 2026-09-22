/**
 * Create menu: two entries (Create Flow Amendment, §4.3, architect-approved
 * 2026-09-22 — Tournament removed as a separate entry), and every
 * dismissal path avoids selecting one.
 */
import React from 'react';

import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import CreateMenu, { CREATE_MENU_ITEMS } from '../CreateMenu';

function mount(visible = true) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const root = render(<CreateMenu visible={visible} onSelect={onSelect} onClose={onClose} />);
  return { root, onSelect, onClose };
}

describe('CreateMenu', () => {
  it('offers exactly Game and Group with their emoji', () => {
    const { root } = mount();
    expect(CREATE_MENU_ITEMS.map(item => item.label)).toEqual(['Create Game', 'Create Group']);
    expect(texts(root)).toEqual(expect.arrayContaining(['🎮', '👥']));
  });

  it.each([
    ['Create Game', 'game'],
    ['Create Group', 'group'],
  ])('"%s" reports %s and does not close by itself', (label, target) => {
    const { root, onSelect, onClose } = mount();
    act(() => pressableLabelled(root, label).props.onPress());
    expect(onSelect).toHaveBeenCalledWith(target);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(['Close create menu', 'Close'])('%s dismisses without selecting', label => {
    const { root, onSelect, onClose } = mount();
    act(() => pressableLabelled(root, label).props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('the Android back button (onRequestClose) dismisses without selecting', () => {
    const { root, onSelect, onClose } = mount();
    const modal = root.find(node => typeof node.props.onRequestClose === 'function');
    act(() => modal.props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

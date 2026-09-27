/**
 * Tests for ShareActionSheet component (DES-MEETUP-MOBILE-ADDENDUM-shareable-links §4).
 */
import React from 'react';

import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import ShareActionSheet from '../ShareActionSheet';

function mount(visible = true) {
  const onShareGeneric = jest.fn();
  const onShareWhatsApp = jest.fn();
  const onCopyLink = jest.fn();
  const onClose = jest.fn();

  const root = render(
    <ShareActionSheet
      visible={visible}
      title="Share Test"
      onShareGeneric={onShareGeneric}
      onShareWhatsApp={onShareWhatsApp}
      onCopyLink={onCopyLink}
      onClose={onClose}
    />,
  );

  return { root, onShareGeneric, onShareWhatsApp, onCopyLink, onClose };
}

describe('ShareActionSheet', () => {
  it('renders title and share action rows', () => {
    const { root } = mount();
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'Share Test',
        'Share via WhatsApp',
        'Share via other apps',
        'Copy Link',
      ]),
    );
  });

  it('triggers onShareWhatsApp when WhatsApp button pressed', () => {
    const { root, onShareWhatsApp, onClose } = mount();
    act(() => pressableLabelled(root, 'Share via WhatsApp').props.onPress());
    expect(onShareWhatsApp).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('triggers onShareGeneric when Share via other apps button pressed', () => {
    const { root, onShareGeneric, onClose } = mount();
    act(() => pressableLabelled(root, 'Share via other apps').props.onPress());
    expect(onShareGeneric).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('triggers onCopyLink when Copy Link button pressed', () => {
    const { root, onCopyLink, onClose } = mount();
    act(() => pressableLabelled(root, 'Copy Link').props.onPress());
    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(['Close share menu', 'Close'])('%s dismisses without triggering action', label => {
    const { root, onClose, onShareGeneric, onShareWhatsApp, onCopyLink } = mount();
    act(() => pressableLabelled(root, label).props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShareGeneric).not.toHaveBeenCalled();
    expect(onShareWhatsApp).not.toHaveBeenCalled();
    expect(onCopyLink).not.toHaveBeenCalled();
  });

  it('onRequestClose dismisses the modal', () => {
    const { root, onClose } = mount();
    const modal = root.find(node => typeof node.props.onRequestClose === 'function');
    act(() => modal.props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

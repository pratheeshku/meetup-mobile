import React from 'react';

import OthersVenueModal from '../OthersVenueModal';
import * as venuesApi from '../../../api/venues';
import {
  act,
  pressableWithText,
  renderAsync,
  texts,
} from '../../../test-utils/render';

jest.mock('../../../api/venues');

const mockGetPostalVenue = venuesApi.getPostalVenue as jest.MockedFunction<typeof venuesApi.getPostalVenue>;

describe('OthersVenueModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates 6-digit postal code and required name on save', async () => {
    const onSave = jest.fn();
    const root = await renderAsync(
      <OthersVenueModal visible={true} onClose={jest.fn()} onSaveOthers={onSave} />,
    );

    const saveBtn = pressableWithText(root, 'Save Venue');

    // Click save without entering anything
    await act(async () => {
      saveBtn.props.onPress();
    });

    const errorTexts = texts(root);
    expect(errorTexts).toContain('Venue name is required');
    expect(errorTexts).toContain('Postal code is required');
    expect(onSave).not.toHaveBeenCalled();

    // Enter invalid postal code (5 digits)
    const postalInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. 579780',
    );
    await act(async () => {
      postalInput.props.onChangeText('12345');
      postalInput.props.onBlur();
    });

    expect(texts(root)).toContain('Postal code must be exactly 6 digits');
  });

  it('validates information link format (http/https only)', async () => {
    const onSave = jest.fn();
    const root = await renderAsync(
      <OthersVenueModal visible={true} onClose={jest.fn()} onSaveOthers={onSave} />,
    );

    const nameInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. Club House Hall',
    );
    const postalInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. 579780',
    );
    const urlInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'https://example.com',
    );

    await act(async () => {
      nameInput.props.onChangeText('Condo Court');
      postalInput.props.onChangeText('123456');
      urlInput.props.onChangeText('ftp://invalid-url');
      urlInput.props.onBlur();
    });

    expect(texts(root)).toContain('URL must begin with http:// or https://');

    const saveBtn = pressableWithText(root, 'Save Venue');
    await act(async () => {
      saveBtn.props.onPress();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('resolves address via getPostalVenue and passes pending status when geocoding is pending', async () => {
    mockGetPostalVenue.mockResolvedValue({
      postal_code: '654321',
      block: null,
      street: null,
      address: undefined,
      lat: null,
      lng: null,
      geocoding_status: 'pending',
    });

    const onSave = jest.fn();
    const root = await renderAsync(
      <OthersVenueModal visible={true} onClose={jest.fn()} onSaveOthers={onSave} />,
    );

    const nameInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. Club House Hall',
    );
    const postalInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. 579780',
    );

    await act(async () => {
      nameInput.props.onChangeText('Private Court');
      postalInput.props.onChangeText('654321');
    });

    // Toggle facility chip
    const chip = pressableWithText(root, 'Tennis Court');
    await act(async () => {
      chip.props.onPress();
    });

    const saveBtn = pressableWithText(root, 'Save Venue');
    await act(async () => {
      saveBtn.props.onPress();
    });

    expect(mockGetPostalVenue).toHaveBeenCalledWith('654321');
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        geocoding_status: 'pending',
        othersInput: expect.objectContaining({
          name: 'Private Court',
          postal_code: '654321',
          facilities: ['Tennis Court'],
        }),
      }),
    );
  });

  it('resolves coordinates and address when OneMap lookup succeeds', async () => {
    mockGetPostalVenue.mockResolvedValue({
      postal_code: '538832',
      block: '93',
      street: 'Hougang Avenue 4',
      address: '93 Hougang Avenue 4',
      lat: 1.3712,
      lng: 103.8885,
      geocoding_status: 'resolved',
    });

    const onSave = jest.fn();
    const root = await renderAsync(
      <OthersVenueModal visible={true} onClose={jest.fn()} onSaveOthers={onSave} />,
    );

    const nameInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. Club House Hall',
    );
    const postalInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. 579780',
    );

    await act(async () => {
      nameInput.props.onChangeText('Hougang Hall');
      postalInput.props.onChangeText('538832');
    });

    const saveBtn = pressableWithText(root, 'Save Venue');
    await act(async () => {
      saveBtn.props.onPress();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '93 Hougang Avenue 4',
        lat: 1.3712,
        lng: 103.8885,
        geocoding_status: 'resolved',
      }),
    );
  });
});

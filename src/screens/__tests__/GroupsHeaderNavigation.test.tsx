/** Groups header "+" in a real native stack (regression: Rules-of-Hooks error on the Groups tab). */
import { getMyGroups } from '../../api/groups';
import { describeHeaderAction } from '../../test-utils/headerActionHarness';
import GroupsScreen from '../GroupsScreen';

jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
(getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 });

describeHeaderAction({
  screen: GroupsScreen as never,
  initial: 'GroupsList',
  target: 'CreateGroup',
  label: 'Create Group',
});

import { characterAction } from '../src/index';

it('tests characterAction', () => {
    const actual = characterAction(`
["コマンド"]

chara.name = "new name"`);
    if (actual.isError === true) {
        fail('actual.isError');
    }
    expect(actual.value['コマンド']?.chara?.name).toBe('new name');
});

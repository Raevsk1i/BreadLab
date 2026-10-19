import 'package:flutter_test/flutter_test.dart';
import 'package:breadlab/data/models/user_state.dart';

void main() {
  test('smoke user state', () {
    expect(UserState().targetFlourG, 400);
  });
}

import { Type } from 'class-transformer';
import { Allow, IsObject, Length, ValidateNested } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import IsUndefinable from '@validators/is-undefinable';

class NestedEntity {
  @Length(2, 5)
  @IsUndefinable()
  hello?: string;
}

@Entity()
class TestEntity {
  @PrimaryGeneratedColumn()
  @Allow()
  id: number;

  @Column()
  @Length(1, 50)
  param: string;

  @Column()
  @Length(1, 50, { groups: ['update'] })
  param2?: string;

  @Type(() => NestedEntity)
  @IsObject()
  @ValidateNested()
  @IsUndefinable()
  nested?: NestedEntity;
}

export default TestEntity;

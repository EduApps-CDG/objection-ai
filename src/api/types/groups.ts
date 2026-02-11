/*import { Contradiction } from './evidence';
import { CaseFrame } from './frame';
import { Location } from './location';*/

export interface BaseGroup {
  id: string;
  name: string;
  comments: Record<string, string>;
  type: GroupType;
}

export interface NormalGroup extends BaseGroup {
  type: GroupType.Normal;
//   frames: CaseFrame[];
}

export interface GameoverGroup extends BaseGroup {
  type: GroupType.Gameover;
//   frames: CaseFrame[];
}

export interface CrossExaminationGroup extends BaseGroup {
  type: GroupType.CrossExamination;
  /*frames: CaseFrame[];
  counselFrames: CaseFrame[];
  failureFrames: CaseFrame[];
  contradictions: Record<string, Contradiction[]>;
  pressFrames: Record<string, CaseFrame[]>;*/
}

export interface InvestigationGroup extends BaseGroup {
  type: GroupType.Investigation;
  //locations: Location[];
}

export type AnyGroup =
  | NormalGroup
  | GameoverGroup
  | CrossExaminationGroup
  | InvestigationGroup;

export enum GroupType {
  Normal = 'normal',
  Gameover = 'gameover',
  CrossExamination = 'cross-examination',
  Investigation = 'investigation',
}

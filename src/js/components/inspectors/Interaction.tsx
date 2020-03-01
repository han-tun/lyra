'use strict';

import * as React from 'react';
import {connect} from 'react-redux';
import { throttle } from "throttle-debounce";
import {State} from '../../store';
import {InteractionRecord, Interaction} from '../../store/factory/Interaction';
import {Property} from './Property';
import {ScaleInfo, LyraApplicationPreviewDef, LyraSelectionPreviewDef} from '../interactions/InteractionPreviewController';
import {applicationPreviewDefs, getScaleInfoForGroup, selectionPreviewDefs, widgetApplicationPreviewDefs} from '../../ctrl/demonstrations';
import {GroupRecord} from '../../store/factory/marks/Group';
import exportName from '../../util/exportName';
import {Dispatch} from 'redux';
import {setSelection, setApplication, setValueInMark, setMarkPropertyValue} from '../../actions/interactionActions';
import {FormInputProperty} from './FormInputProperty';

const ctrl = require('../../ctrl');
const getInVis = require('../../util/immutable-utils').getInVis;

interface OwnProps {
  primId: number;
}

interface OwnState {
  size: number;
  color: string;
  opacity: number;
}

interface DispatchProps {
  setSelection: (def: LyraSelectionPreviewDef, id: number) => void;
  setMapping: (def: LyraApplicationPreviewDef, id: number) => void;
  setValueInMark: (payload: any, id: number) => void;
  setMarkPropertyValue: (payload: any, id: number) => void;
}

interface StateProps {
  interaction: InteractionRecord;
  applicationDefs: LyraApplicationPreviewDef[];
  selectionDefs: LyraSelectionPreviewDef[];
  mappingOptions: string[];
  selectionOptions: string[];
  fields: string[];
  type: string;
}


function mapStateToProps(state: State, ownProps: OwnProps): StateProps {
  const interaction = state.getIn(['vis', 'present', 'interactions',  String(ownProps.primId)]);
  const groupId = interaction.get('groupId');
  const scaleInfo: ScaleInfo = getScaleInfoForGroup(state, groupId);
  const groupRecord: GroupRecord = state.getIn(['vis', 'present', 'marks', String(groupId)]);
  const isInterval = interaction.selectionDef && interaction.selectionDef.id.startsWith('brush') ? true : false;
  let type = 'brush';
  if(interaction.selectionDef) {
    if(interaction.selectionDef.id.startsWith('widget_')) type = 'widget'
    else if(!isInterval) {
      type = interaction.selectionDef.id;
    }
  }

  const field = interaction.selectionDef && interaction.selectionDef.field;
  const marksOfGroup = groupRecord.marks.map((markId) => {
    return state.getIn(['vis', 'present', 'marks', String(markId)]).toJS();
  }).filter((mark) => {
    return !(mark.type === 'group' || mark.name.indexOf('lyra') === 0);
  });
  const applicationDefs =  applicationPreviewDefs(isInterval, marksOfGroup, scaleInfo, exportName(groupRecord.name), ctrl.export());
  const applicationOptions = applicationDefs.map(e => e.id);
  const selectionDefs = selectionPreviewDefs(true, true, marksOfGroup, scaleInfo, field);
  const selectionOptions = selectionDefs.map(e => e.id);

  const dsId = marksOfGroup[0].from.data;
  const dataset =  getInVis(state, 'datasets.' + dsId);
  const schema = dataset.get('_schema');
  const fields = schema.keySeq().toArray();

  return {
    interaction,
    applicationDefs: applicationDefs,
    mappingOptions: applicationOptions,
    selectionDefs,
    selectionOptions,
    fields,
    type,
  };
}

function mapDispatchToProps(dispatch: Dispatch, ownProps: OwnProps): DispatchProps {
  return {
    setSelection: (def: LyraSelectionPreviewDef, id: number) => {
      dispatch(setSelection(def, id));
    },
    setMapping: (def: LyraApplicationPreviewDef, id: number) => {
      dispatch(setApplication(def, id));
    },
    setValueInMark: (payload: any, id: number) => {
      dispatch(setValueInMark(payload, id));
    },
    setMarkPropertyValue: (payload: any, id: number) => {
      dispatch(setMarkPropertyValue(payload, id));
    }
  };
}

export function updateVal(field: string) {
  return `datum && !datum.manipulator && item().mark.marktype !== 'group' ? {unit: \"layer_0\", fields: points_tuple_fields, values: [(item().isVoronoi ? datum.datum : datum)['${field ? field : '_vgsid_'}']]} : null`
}
class BaseInteractionInspector extends React.Component<OwnProps & StateProps & DispatchProps, OwnState> {
  [x: string]: any;
  constructor(props) {
    super(props);

    this.state = {
      size: 100,
      color: '#666666',
      opacity: 0.2
    }
    this.handleApplicationChange = this.handleApplicationChange.bind(this);
    this.handleSelectionChange = this.handleSelectionChange.bind(this);
    this.handlePropertyChangeThrottled = throttle(500, this.handlePropertyChange);
  }

  // componentWillMount() {
  //   const name = 'lyra_interaction_' + this.props.primId + '_size';
  //   this.props.initSignal(name, 100);
  // }

  public handleApplicationChange(value) {
    if(this.props.type == 'widget') {
      const fieldName = this.props.interaction.selection.field;
      const previousApplicationDef = this.props.interaction.application;
      const defs = widgetApplicationPreviewDefs(fieldName, previousApplicationDef.groupName, previousApplicationDef.comparator);
      const def = defs.filter(e => e.id === value);
      this.props.setMapping(def[0], this.props.interaction.id);
    } else {
      const preview = this.props.applicationDefs.filter(e => e.id === value);
      if(preview.length) {
        if (this.props.interaction.application && this.props.interaction.application.id === preview[0].id) {
          this.props.setMapping(null, this.props.interaction.id);
        }
        else {
          if (!this.props.interaction.selection) {
            this.props.setSelection(this.props.selectionDefs[0], this.props.interaction.id);
          }
          this.props.setMapping(preview[0], this.props.interaction.id);
        }
      }
    }
    this.handlePropertyChange();
  }


  public handleSelectionChange(value) {
    const preview = this.props.selectionDefs.filter(e => e.id === value);
    if(preview.length) {
      if (this.props.interaction.selection && this.props.interaction.selection.id === preview[0].id) {
        this.props.setSelection(null, this.props.interaction.id);

      }
      else {
        const fieldPresent = this.props.interaction.selection && this.props.interaction.selection.field ? true: false;
        this.props.setSelection(preview[0], this.props.interaction.id);
        if(fieldPresent) {
          this.handleFieldChange(this.props.interaction.selection.field, preview[0]);
        }
      }
    }
  }

  public handleFieldChange(field, def=this.props.interaction.selection) {
    const currentDef = JSON.parse(JSON.stringify(def));
    if(currentDef && currentDef.signals.length) {
      currentDef.signals[0].on[0]['update'] = updateVal(field);
      currentDef.signals[1]['value'][0].field = field;
      currentDef.field = field;
      this.props.setSelection(currentDef, this.props.interaction.id);
    }
  }

  public handlePropertyChange() {
    if(!this.props.interaction.application) this.handleApplicationChange('color');
    const {markPropertyValues} = this.props.interaction
    const id = this.props.interaction.application.id;
    const update = this.props.interaction.application.markProperties.encode.update;
    if(id == 'color' && update.fill[1].value != markPropertyValues.color) {
      this.props.setValueInMark({property: 'fill', value: markPropertyValues.color}, this.props.interaction.id);
    } else if (id == 'opacity' && update.fillOpacity[1].value != markPropertyValues.opacity) {
      this.props.setValueInMark({property: 'fillOpacity', value: markPropertyValues.opacity}, this.props.interaction.id);
    } else if (id == 'size' && update.size[1].value != markPropertyValues.size) {
      this.props.setValueInMark({property: 'size', value: markPropertyValues.size}, this.props.interaction.id);
    }

  }

  public onPropertyChange(e, field):void {
    const value = e.target && e.target.value;
    if(value) {
      this.props.setMarkPropertyValue({property: field, value}, this.props.interaction.id);
      this.handlePropertyChangeThrottled();
    }
  }

  public render() {
    let mapOptions = this.props.mappingOptions.map(e=> {
      return <option key={e} value={e}>{e}</option>
    });
    mapOptions.push(<option hidden key='_blank1' value=''>Select Channel</option>)

    let selectionOptions = this.props.selectionOptions.map(e=> {
      return <option key={e} value={e}>{e}</option>
    });
    mapOptions.push(<option hidden key='_blank2' value=''>Select Type</option>)

    let fieldOptions = this.props.fields.map(e => {
      return <option key={e} value={e}>{e}</option>
    });
    fieldOptions.push(<option key='_blank3' value='_vgsid_'>None</option>)

    const props = this.props;
    const interaction = this.props.interaction;
    const selectionDef = interaction.selection;
    const applicationDef = interaction.application;
    const markPropertyValues = interaction.get('markPropertyValues');
    return (
      <div>
        <div className='property-group'>
          <h3 className='label'>Placeholder</h3>
          <ul>
            <li>Name: {interaction.get('name')}</li>
            <li>Selection: {selectionDef ? selectionDef.label : ''}</li>
            <li>Mapping: {applicationDef ? applicationDef.label : ''}</li>
          </ul>
        </div>

        <div className='property-group'>
          <h3 className='label'>Settings</h3>
          <ul>
          Selection :
          {this.props.type == 'widget' ? 'Widget' :
            <select value={selectionDef ? selectionDef.id : ''} onChange={e => this.handleSelectionChange(e.target.value)}>
              {selectionOptions}
            </select>
          }
          </ul>

          <ul>
          Channel :
          <select value={applicationDef ? applicationDef.id : ''} onChange={e => this.handleApplicationChange(e.target.value)}>
            {mapOptions}
          </select>
          </ul>

          <ul className={this.props.type === 'widget' ? '' : 'hidden'}>
            Field: {selectionDef && selectionDef.field}
          </ul>

          <ul className={this.props.type === 'multi' || this.props.type =='single' ? '': 'hidden'}>
          Project On :
          <select value={selectionDef ? selectionDef.field : '_vgsid_'} onChange={e => this.handleFieldChange(e.target.value)}>
            {fieldOptions}
          </select>
          </ul>
        </div>

        <div className={applicationDef && applicationDef.id=='size' ? '':'hidden'}>
          Size:
          <FormInputProperty
            name='size'
            id='Size'
            onChange={(e) => this.onPropertyChange(e, 'size')}
            value={markPropertyValues.size}
            type='number'
            min='0'
            max='500'
            disabled={false}>
          </FormInputProperty>
          <br />
        </div>

        <div className={applicationDef && applicationDef.id == 'color' ? '' : 'hidden'}>
          Color:
          <FormInputProperty
            name='color'
            id='Color'
            onChange={(e) => this.onPropertyChange(e, 'color')}
            value={markPropertyValues.color}
            type='color'
            disabled={false}>
          </FormInputProperty>
          <br />
        </div>

        <div className={applicationDef && applicationDef.id == 'opacity' ? '' : 'hidden'}>
          Opacity:
          <FormInputProperty
            name='opacity'
            id='Opacity'
            onChange={(e) => this.onPropertyChange(e, 'opacity')}
            value={markPropertyValues.opacity}
            min='0'
            max='1'
            step='0.05'
            type='range'
            disabled={false}>
          </FormInputProperty>
        </div>

      </div>
    );
  }
};

export const InteractionInspector = connect(mapStateToProps, mapDispatchToProps)(BaseInteractionInspector);
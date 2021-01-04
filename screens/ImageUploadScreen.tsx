import * as React from 'react';
import { StyleSheet , TouchableOpacity, Image, FlatList, ScrollView } from 'react-native';
import { Icon, ListItem } from "react-native-elements";

import EditScreenInfo from '../components/EditScreenInfo';
import { Text, View } from '../components/Themed';

import * as ImagePicker from "expo-image-picker";
import * as Permissions from "expo-permissions";
import * as ImageManipulator from "expo-image-manipulator";
import { TapGestureHandler } from 'react-native-gesture-handler';
import * as tf from '@tensorflow/tfjs';
import { IModelPredictionTiming, ModelPrediction, ModelService } from '../services/modelService';
import { AppConfig } from '../config';

type State = {
  image: string; 
  loading?:boolean;
  isTfReady?: boolean;
  isModelReady?: boolean;
  predictions: ModelPrediction[]|null;
  error?:string|null;
  timing:IModelPredictionTiming|null;
};

export default class  TabOneScreen extends React.Component<{}, State> {

  state:State = {
    image: "",
    predictions: null ,
    timing: null
  }

  modelService!: ModelService;

  async componentDidMount() {
    this.setState({ loading: true });
    this.modelService = await ModelService.create(AppConfig.imageSize);
    this.setState({ isTfReady: true,isModelReady: true,loading: false  });
  }

  openImagePicker = async () => {
    try {      
      await this.verifyPermission();

      let permResult = await ImagePicker.requestCameraPermissionsAsync();
      if(permResult.granted === false) {
        alert("Permission to access camera roll is required!");
        return;
      }
  
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, aspect: [4,3]
      });
      console.log(pickerResult);
      if(!pickerResult.cancelled){
        let result =  await ImageManipulator.manipulateAsync(pickerResult.uri,
          [{ resize: { width: 224, height: 224}}],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG,base64:true }
          );
        this.setState({ image: result.uri })
      }
    } catch (error) {
      console.log("Error getting image" + error);
    }
  }

  pickFromCamera = async () => {
    try {
      await this.verifyPermission();   
  
      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, aspect: [4,3], allowsEditing: true
      });
      console.log(pickerResult);
      if(!pickerResult.cancelled){
        let result =  await ImageManipulator.manipulateAsync(pickerResult.uri,
          [{ resize: { width: 224, height: 224}}],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG,base64:true }
          );
        this.setState({ image: result.uri })
      }
    } catch (error) {
      console.log("Error getting image from camera" + error);
    }
  }

  verifyPermission = async () => {
    const resp = await Permissions.getAsync( Permissions.CAMERA, Permissions.CAMERA_ROLL);
    if(!resp.granted)
    {
       const reqResp = await Permissions.askAsync(Permissions.CAMERA, Permissions.CAMERA_ROLL);
       console.log(reqResp);
       if(reqResp.granted){
         console.log("Granted access to photos")         
       }
       else{
         alert("You have not been granted permissions");
         throw new Error("Permission refused");         
       }
    }

  }

  classifyImage = async () => {
    try {
      const res:ImageManipulator.ImageResult = await ImageManipulator.manipulateAsync(this.state.image,
        [{ resize: { width:224, height:224 }}],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG,base64:true }
        );
      
      //this.setState({ image: res})
      console.log('numTensors (before prediction): ' + tf.memory().numTensors);
      this.setState({ predictions: [] ,error:null , loading:true })

      const predictionResponse = await this.modelService.classifyImage(res);
      
      
      if (predictionResponse.error){
        this.setState({ error: predictionResponse.error , loading:false})
      }else{
        const predictions = predictionResponse.predictions  || null;
        this.setState({ predictions: predictions, timing: predictionResponse.timing,  loading:false})
      }
      
      
      //tf.dispose(predictions);
      console.log('numTensors (after prediction): ' + tf.memory().numTensors);

    } catch (error) {
      console.log('Exception Error: ', error)
    }
  }

 render() {
   const { image, isTfReady, isModelReady } = this.state;
  //  if(!isTfReady)
  //   return (
  //     <Text>Loading tensorflow..</Text>
  //   )
  return (    
    <View style={styles.container}>
      <View style={ styles.containerRow}>
        {/* <TouchableOpacity onPress={this.openImagePicker} style={styles.buttonBackground}>
          <Text style={styles.buttonText}>Pick an image please</Text>
        </TouchableOpacity> */}
        <Icon name="camera-alt" raised onPress={this.pickFromCamera} />
        <Icon name="image" raised onPress={this.openImagePicker} />

      </View>
      <View style={styles.midContainer}>
        { image !== "" && 
           <Image source={{uri: image}}  style={styles.pickedImage}/>
        }
      </View>
      <View style={styles.container}>
        <TouchableOpacity style={styles.buttonBackground} onPress={this.classifyImage}><Text style={styles.buttonText}>classify image</Text></TouchableOpacity>

      </View>
      <View style={styles.container}>
        {this.renderPredictions()}
      </View>
    </View>
  );
 }

 renderPredictions(){
   const {predictions} = this.state;
   const renderItem = (item: ModelPrediction) => (
    <ListItem title={item.className} subtitle={`prob: ${item.probability.toFixed(AppConfig.precision)}`} />
  );
   if(predictions && predictions.length > 0) {
    return (
      <View style={styles.containerRow}>
        <View style={styles.container}>
            <Text>Predictions</Text>
            <View>
                {
                    <FlatList
                    data={predictions}
                    keyExtractor={(item) => item.className}
                    renderItem={( {item } ) => (
                      <ListItem style={styles.item} >
                        <ListItem.Title>{item.className}</ListItem.Title>
                        <ListItem.Subtitle>{`prob: ${item.probability.toFixed(AppConfig.precision)}`}</ListItem.Subtitle>
                      </ListItem>
                    )}
                  />
                }
            </View>
          </View>
          <View style={styles.container}>
            <Text>Timing (ms)</Text>
            <View>
              <Text>total time: {this.state.timing?.totalTime}</Text>
              <Text>loading time: {this.state.timing?.imageLoadingTime}</Text>
              <Text>preprocessing time: {this.state.timing?.imagePreprocessing}</Text>
              <Text>prediction time: {this.state.timing?.imagePrediction}</Text>
              <Text>decode time: {this.state.timing?.imageDecodePrediction}</Text>
            
            </View>
          </View>

      </View>
  )
   } else  { return null }
 }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerRow: {
    flexDirection: 'row'
  },
  midContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  instructions: {
    fontSize: 14,
    color: "grey"
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  buttonBackground: {
    backgroundColor: "grey",
    padding: 20,
    borderRadius: 5
  },
  buttonText: {
    fontSize: 20,
    color: 'black'
  },
  pickedImage: {
    height: 300,
    width: 300,
    resizeMode: "contain"
  },
  item: {
    padding: 1,
  margin: 1,
    fontSize: 10
  },
  
});

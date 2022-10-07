mkdir -p ./$1/$2/k8s
cp -rf ./base ./$1/$2/k8s
cp -rf ./overlays ./$1/$2/k8s
LC_ALL=C find ./$1/$2/k8s -type f -name '*.yaml' -exec sed -i '' s/NAME_SPACE/$1/ {} +
LC_ALL=C find ./$1/$2/k8s -type f -name '*.yaml' -exec sed -i '' s/APP_NAME/$2/ {} +
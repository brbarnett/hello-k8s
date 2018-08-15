# Hello Kubernetes!

## Create an AKS cluster
You'll need the latest Azure CLI. Download here: [https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest)

### Log in to Azure CLI
```
az login
az account set --subscription
00000000-0000-0000-0000-000000000000
```

### Create primary resource group
```
az group create -l centralus -n Kubernetes
```

### Find latest version
Latest is on the bottom of the list. When creating the cluster, use the same location and its corresponding latest version value
```
az aks get-versions -l centralus
```

### Create AKS cluster
The cluster resource itself will be in the named resource group, but it will also automatically create a managed cluster resource group that will contain all of the resources to support the node VMs. The name is auto-created in the format of MC_[Resource Group]_[AKS Cluster Name]_[Location], so in this example it will be MC_Kubernetes_rp-aks-centralus_centralus
Follow this guide for instructions on AAD integration: [https://docs.microsoft.com/en-us/azure/aks/aad-integration](https://docs.microsoft.com/en-us/azure/aks/aad-integration)
```
az aks create `
    -g Kubernetes `
    -n rp-aks-centralus `
    -l centralus `
    -c 3 `
    -s Standard_DS1_v2 `
    --aad-server-app-id 00000000-0000-0000-0000-000000000000 `
    --aad-server-app-secret xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx= `
    --aad-client-app-id 00000000-0000-0000-0000-000000000000 `
    --aad-tenant-id 00000000-0000-0000-0000-000000000000 `
    --enable-rbac `
    --kubernetes-version 1.11.1 `
    --enable-addons http_application_routing `
    --no-wait
```
	
### Install kubectl
```
az aks install-cli --client-version latest
```

### Get cluster credentials
This will merge credentials into your local kubectl context
```
az aks get-credentials -g Kubernetes -n rp-aks-centralus -a
```

### Check that the nodes are ready and that the Kubernetes system pods are running
```
kubectl get nodes -o wide
kubectl get pods --all-namespaces -o wide
```

### Delete the `kubernetes-dashboard` resources 
Its access level is considered an attack vector
```
kubectl delete deployment kubernetes-dashboard -n kube-system
kubectl delete service kubernetes-dashboard -n kube-system
kubectl delete secret kubernetes-dashboard-key-holder -n kube-system
kubectl delete secret kubernetes-dashboard-token-8bv4h -n kube-system
```